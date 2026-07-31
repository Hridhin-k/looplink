import WebSocket from "ws";
import {
  MessageType,
  RECONNECT_INTERVAL_MS,
  parseProtocolMessage,
  type CreateTunnelMessage,
  type ProtocolMessage,
  type TunnelCreatedMessage,
} from "@hridhin-k/badger-shared";
import { randomUUID } from "node:crypto";

import { ConnectionState } from "./connection-state.js";
import { Heartbeat } from "./heartbeat.js";
import type { InboundForwardingMessage } from "./request-forwarder.js";
import { rawDataToString } from "../utils/raw-data.js";

/**
 * Configuration for {@link BadgerWebSocketClient}.
 */
export interface WebSocketClientOptions {
  /** WebSocket URL of the Badger server. */
  readonly url: string;
  /**
   * When `true`, the client retries after an unexpected disconnect.
   */
  readonly reconnect: boolean;
  /**
   * Delay between reconnect attempts. Defaults to the shared protocol interval.
   */
  readonly reconnectIntervalMs?: number;
  /**
   * Delay between keepalive `PING` messages. Defaults to the shared protocol
   * interval; override only in tests.
   */
  readonly heartbeatIntervalMs?: number;
  /**
   * Invoked when the live connection drops unexpectedly and reconnect is armed.
   *
   * @param error - Reason the previous socket closed.
   */
  readonly onConnectionLost?: (error: Error) => void;
  /**
   * Invoked after a successful reconnect that restored or replaced the tunnel.
   *
   * @param tunnel - Tunnel session active on the new connection.
   * @param restored - `true` when the previous tunnel id was reclaimed.
   */
  readonly onReconnected?: (tunnel: TunnelCreatedMessage, restored: boolean) => void;
  /**
   * Invoked when a reconnect attempt fails; another attempt will be scheduled.
   *
   * @param error - Failure from the latest attempt.
   */
  readonly onReconnectFailed?: (error: Error) => void;
  /**
   * Optional async supplier for a bearer access token attached to the
   * WebSocket upgrade request.
   */
  readonly getAuthToken?: () => Promise<string | undefined>;
  /**
   * Optional workspace id sent as `X-Workspace-Id` so tunnels attach to a
   * shared workspace instead of the user's personal default.
   */
  readonly getWorkspaceId?: () => Promise<string | undefined>;
  /**
   * Optional anonymous session token sent as `X-Anonymous-Session` when the
   * CLI is not logged in.
   */
  readonly getAnonymousSessionToken?: () => Promise<string | undefined>;
}

/**
 * Tunnel session remembered across reconnects.
 */
export interface ActiveTunnelSession {
  /** Local TCP port being exposed. */
  readonly port: number;
  /** Server-assigned tunnel id. */
  readonly tunnelId: string;
  /** Public URL for the tunnel. */
  readonly publicUrl: string;
}

/**
 * Narrow connection surface consumed by application services.
 */
export interface ServerConnection {
  /**
   * Opens the connection and resolves once the handshake succeeds.
   */
  connect(): Promise<void>;

  /**
   * Closes the connection if one is open and cancels automatic reconnect.
   */
  disconnect(): Promise<void>;

  /**
   * Returns the current connection lifecycle state.
   */
  getState(): ConnectionState;

  /**
   * Returns the last known tunnel session, if any.
   */
  getActiveTunnel(): ActiveTunnelSession | undefined;

  /**
   * Sends a protocol message to the server.
   *
   * @param message - Protocol payload to serialize and send.
   */
  send(message: ProtocolMessage): void;

  /**
   * Waits for the next inbound message that satisfies `match`.
   *
   * Buffered messages received before the wait are considered first.
   *
   * @param match - Predicate selecting the desired message.
   * @param timeoutMs - Maximum time to wait before rejecting.
   */
  waitForMessage(
    match: (message: ProtocolMessage) => boolean,
    timeoutMs?: number,
  ): Promise<ProtocolMessage>;

  /**
   * Requests a tunnel for a local port and resolves with the server response.
   *
   * @param port - Local TCP port to expose.
   * @param preferredTunnelId - Prior tunnel id to reclaim after a reconnect.
   */
  createTunnel(port: number, preferredTunnelId?: string): Promise<TunnelCreatedMessage>;

  /**
   * Registers the consumer for inbound HTTP forwarding frames.
   *
   * The handler survives reconnects: frames from a restored tunnel are routed
   * to the same consumer.
   *
   * @param handler - Receives `http_request_*` and `http_cancel` frames.
   */
  setForwardingHandler(handler: (message: InboundForwardingMessage) => void): void;
}

interface MessageWaiter {
  readonly match: (message: ProtocolMessage) => boolean;
  readonly resolve: (message: ProtocolMessage) => void;
  readonly reject: (error: Error) => void;
  readonly timer: ReturnType<typeof setTimeout>;
}

/** Default timeout for waiting on a correlated protocol response. */
const DEFAULT_WAIT_TIMEOUT_MS = 10_000;

/**
 * WebSocket client that maintains a single connection to the Badger server.
 *
 * When `reconnect` is enabled, unexpected closes schedule a retry every
 * {@link RECONNECT_INTERVAL_MS} and attempt to reclaim the previous tunnel.
 */
export class BadgerWebSocketClient implements ServerConnection {
  private state: ConnectionState = ConnectionState.Disconnected;
  private socket: WebSocket | undefined;
  private readonly inbox: ProtocolMessage[] = [];
  private waiter: MessageWaiter | undefined;
  private heartbeat: Heartbeat | undefined;
  private intentionalClose = false;
  private reconnectTimer: ReturnType<typeof setTimeout> | undefined;
  private reconnectInFlight = false;
  private activeTunnel: ActiveTunnelSession | undefined;
  private forwardingHandler: ((message: InboundForwardingMessage) => void) | undefined;
  private readonly reconnectIntervalMs: number;

  /**
   * @param options - Connection URL and reconnect policy.
   */
  constructor(private readonly options: WebSocketClientOptions) {
    this.reconnectIntervalMs = options.reconnectIntervalMs ?? RECONNECT_INTERVAL_MS;
  }

  /**
   * Returns the current connection lifecycle state.
   *
   * @returns The latest {@link ConnectionState}.
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Returns the last known tunnel session, if any.
   *
   * @returns The active tunnel metadata remembered for reconnect restoration.
   */
  getActiveTunnel(): ActiveTunnelSession | undefined {
    return this.activeTunnel;
  }

  /**
   * Opens a WebSocket to the configured server URL.
   *
   * @returns A promise that resolves on a successful handshake.
   * @throws Error When the handshake fails or the socket closes before opening.
   */
  async connect(): Promise<void> {
    if (this.state === ConnectionState.Connected) {
      return Promise.resolve();
    }

    if (this.state === ConnectionState.Connecting) {
      return Promise.reject(new Error("A connection attempt is already in progress."));
    }

    this.intentionalClose = false;
    this.setState(ConnectionState.Connecting);

    const token = await this.options.getAuthToken?.().catch(() => undefined);
    const workspaceId = await this.options.getWorkspaceId?.().catch(() => undefined);
    const anonymousToken = await this.options.getAnonymousSessionToken?.().catch(() => undefined);

    return new Promise<void>((resolve, reject) => {
      const headers: Record<string, string> = {};
      if (token !== undefined) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      if (workspaceId !== undefined && workspaceId.trim().length > 0) {
        headers["X-Workspace-Id"] = workspaceId.trim();
      }
      if (anonymousToken !== undefined && anonymousToken.trim().length > 0) {
        headers["X-Anonymous-Session"] = anonymousToken.trim();
      }

      const socket = new WebSocket(this.options.url, {
        ...(Object.keys(headers).length === 0 ? {} : { headers }),
      });
      this.socket = socket;

      const onOpen = (): void => {
        cleanup();
        this.setState(ConnectionState.Connected);
        this.bindRuntimeHandlers(socket);
        resolve();
      };

      const onError = (error: Error): void => {
        cleanup();
        this.disposeSocket();
        this.setState(ConnectionState.Disconnected);
        reject(error);
      };

      const onClose = (code: number, reason: Buffer): void => {
        cleanup();
        this.disposeSocket();
        this.setState(ConnectionState.Disconnected);
        reject(new Error(formatSocketCloseError(code, reason, this.options.url)));
      };

      const onMessage = (data: WebSocket.RawData): void => {
        this.handleIncomingData(data);
      };

      const cleanup = (): void => {
        socket.off("open", onOpen);
        socket.off("error", onError);
        socket.off("close", onClose);
        // Keep `message` — runtime handlers own it after open. During connect we
        // still want early frames (e.g. CONNECTED) buffered before open settles.
      };

      socket.on("message", onMessage);
      socket.once("open", onOpen);
      socket.once("error", onError);
      socket.once("close", onClose);
    });
  }

  /**
   * Closes the active WebSocket, if any, and cancels automatic reconnect.
   *
   * @returns A promise that resolves once the socket has closed.
   */
  disconnect(): Promise<void> {
    this.intentionalClose = true;
    this.clearReconnectTimer();
    this.reconnectInFlight = false;

    const socket = this.socket;

    if (socket === undefined || this.state === ConnectionState.Disconnected) {
      this.setState(ConnectionState.Disconnected);
      return Promise.resolve();
    }

    if (this.state === ConnectionState.Reconnecting) {
      this.setState(ConnectionState.Disconnected);
      return Promise.resolve();
    }

    this.setState(ConnectionState.Disconnecting);

    return new Promise<void>((resolve) => {
      socket.once("close", () => {
        this.disposeSocket();
        this.setState(ConnectionState.Disconnected);
        resolve();
      });
      socket.close();
    });
  }

  /**
   * Sends a protocol message to the server.
   *
   * @param message - Protocol payload to serialize and send.
   * @throws Error When the socket is not connected.
   */
  send(message: ProtocolMessage): void {
    const socket = this.socket;

    if (socket === undefined || this.state !== ConnectionState.Connected) {
      throw new Error("Cannot send: not connected to the Badger server.");
    }

    if (socket.readyState !== WebSocket.OPEN) {
      throw new Error("Cannot send: WebSocket is not open.");
    }

    socket.send(JSON.stringify(message));
  }

  /**
   * Waits for the next inbound message that satisfies `match`.
   *
   * @param match - Predicate selecting the desired message.
   * @param timeoutMs - Maximum time to wait before rejecting.
   * @returns The matched protocol message.
   */
  waitForMessage(
    match: (message: ProtocolMessage) => boolean,
    timeoutMs: number = DEFAULT_WAIT_TIMEOUT_MS,
  ): Promise<ProtocolMessage> {
    const bufferedIndex = this.inbox.findIndex(match);

    if (bufferedIndex >= 0) {
      const [message] = this.inbox.splice(bufferedIndex, 1);
      if (message === undefined) {
        return Promise.reject(new Error("Invariant: matched inbox entry was missing."));
      }
      return Promise.resolve(message);
    }

    if (this.waiter !== undefined) {
      return Promise.reject(new Error("Another message wait is already in progress."));
    }

    return new Promise<ProtocolMessage>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiter = undefined;
        reject(new Error(`Timed out waiting for a protocol message after ${String(timeoutMs)}ms.`));
      }, timeoutMs);

      this.waiter = {
        match,
        resolve: (message) => {
          clearTimeout(timer);
          this.waiter = undefined;
          resolve(message);
        },
        reject: (error) => {
          clearTimeout(timer);
          this.waiter = undefined;
          reject(error);
        },
        timer,
      };
    });
  }

  /**
   * Requests a tunnel for a local port and resolves with the server response.
   *
   * @param port - Local TCP port to expose.
   * @param preferredTunnelId - Prior tunnel id to reclaim after a reconnect.
   * @returns The server's {@link TunnelCreatedMessage}.
   */
  async createTunnel(port: number, preferredTunnelId?: string): Promise<TunnelCreatedMessage> {
    const requestId = randomUUID();
    const request: CreateTunnelMessage = {
      type: MessageType.CreateTunnel,
      requestId,
      port,
      ...(preferredTunnelId === undefined ? {} : { tunnelId: preferredTunnelId }),
    };

    const responsePromise = this.waitForMessage((message) => {
      if (message.type === MessageType.TunnelCreated) {
        return message.requestId === requestId;
      }

      if (message.type === MessageType.Error) {
        return message.requestId === requestId;
      }

      return false;
    });

    this.send(request);

    const response = await responsePromise;

    if (response.type === MessageType.Error) {
      throw new Error(response.message);
    }

    if (response.type !== MessageType.TunnelCreated) {
      throw new Error(`Unexpected response type "${response.type}".`);
    }

    this.activeTunnel = {
      port,
      tunnelId: response.tunnelId,
      publicUrl: response.publicUrl,
    };

    return response;
  }

  private bindRuntimeHandlers(socket: WebSocket): void {
    this.heartbeat = new Heartbeat(() => {
      this.sendHeartbeatPing();
    }, this.options.heartbeatIntervalMs);
    this.heartbeat.start();

    socket.on("close", (code: number, reason: Buffer) => {
      const wasIntentional = this.intentionalClose;
      this.failWaiter(new Error(formatSocketCloseError(code, reason)));
      this.disposeSocket();
      this.setState(ConnectionState.Disconnected);

      if (!wasIntentional) {
        this.scheduleReconnect(new Error("Connection to the Badger server was lost."));
      }
    });

    socket.on("error", () => {
      // `close` always follows `error` for `ws`; reconnect is decided there.
    });
  }

  private handleIncomingData(data: WebSocket.RawData): void {
    const parsed = parseProtocolMessage(rawDataToString(data));

    if (!parsed.ok) {
      return;
    }

    this.deliver(parsed.value);
  }

  /**
   * Registers the consumer for inbound HTTP forwarding frames.
   *
   * @param handler - Receives `http_request_*` and `http_cancel` frames.
   */
  setForwardingHandler(handler: (message: InboundForwardingMessage) => void): void {
    this.forwardingHandler = handler;
  }

  private deliver(message: ProtocolMessage): void {
    if (isInboundForwardingMessage(message)) {
      // Data-plane frames go straight to the forwarding consumer. Without a
      // handler they are dropped instead of growing the inbox unboundedly.
      this.forwardingHandler?.(message);
      return;
    }

    const waiter = this.waiter;

    if (waiter?.match(message) === true) {
      waiter.resolve(message);
      return;
    }

    if (message.type === MessageType.Pong) {
      // Heartbeat replies carry no payload; buffering them would grow the
      // inbox unboundedly over a long-lived session.
      return;
    }

    this.inbox.push(message);
  }

  /**
   * Sends a keepalive `PING` if the connection is still healthy. Failures are
   * swallowed: the `close` handler is the single owner of disconnect handling.
   */
  private sendHeartbeatPing(): void {
    if (this.state !== ConnectionState.Connected) {
      return;
    }

    try {
      this.send({ type: MessageType.Ping, requestId: randomUUID() });
    } catch {
      // The socket is racing toward close; the close handler cleans up.
    }
  }

  private failWaiter(error: Error): void {
    if (this.waiter === undefined) {
      return;
    }

    this.waiter.reject(error);
  }

  private scheduleReconnect(error: Error): void {
    if (!this.options.reconnect || this.intentionalClose) {
      return;
    }

    if (this.reconnectTimer !== undefined || this.reconnectInFlight) {
      return;
    }

    this.setState(ConnectionState.Reconnecting);
    this.options.onConnectionLost?.(error);

    // Deliberately referenced: while a retry is pending the socket is gone, so
    // this timer is the only thing keeping the CLI alive. `disconnect` clears
    // it, which is what lets an intentional stop exit promptly.
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = undefined;
      void this.attemptReconnect();
    }, this.reconnectIntervalMs);
  }

  private async attemptReconnect(): Promise<void> {
    if (this.intentionalClose || !this.options.reconnect) {
      this.setState(ConnectionState.Disconnected);
      return;
    }

    this.reconnectInFlight = true;
    this.setState(ConnectionState.Reconnecting);

    try {
      await this.connect();
      await this.waitForMessage((message) => message.type === MessageType.Connected);

      const session = this.activeTunnel;
      if (session === undefined) {
        this.reconnectInFlight = false;
        return;
      }

      const previousTunnelId = session.tunnelId;
      const tunnel = await this.createTunnel(session.port, previousTunnelId);
      const restored = tunnel.tunnelId === previousTunnelId;

      this.reconnectInFlight = false;
      this.options.onReconnected?.(tunnel, restored);
    } catch (error: unknown) {
      this.reconnectInFlight = false;
      this.disposeSocket();
      this.setState(ConnectionState.Disconnected);

      const failure = error instanceof Error ? error : new Error("Reconnect attempt failed.");
      this.options.onReconnectFailed?.(failure);
      this.scheduleReconnect(failure);
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer !== undefined) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = undefined;
    }
  }

  private disposeSocket(): void {
    this.heartbeat?.stop();
    this.heartbeat = undefined;

    if (this.socket !== undefined) {
      this.socket.removeAllListeners();
      this.socket = undefined;
    }

    this.inbox.length = 0;
  }

  private setState(state: ConnectionState): void {
    this.state = state;
  }
}

/**
 * Narrows a protocol message to the HTTP forwarding frames a CLI consumes.
 *
 * @param message - Any parsed protocol message.
 * @returns `true` for request-plane and cancel frames.
 */
function isInboundForwardingMessage(message: ProtocolMessage): message is InboundForwardingMessage {
  return (
    message.type === MessageType.HttpRequestStart ||
    message.type === MessageType.HttpRequestChunk ||
    message.type === MessageType.HttpRequestEnd ||
    message.type === MessageType.HttpCancel
  );
}

function formatSocketCloseError(code: number, reason: Buffer, url?: string): string {
  const detail = reason.toString("utf8").trim();
  if (detail.length > 0) {
    return detail;
  }
  if (url !== undefined) {
    return `Connection closed (${String(code)}) while connecting to ${url}.`;
  }
  return `Connection closed (${String(code)}) while waiting for a protocol message.`;
}
