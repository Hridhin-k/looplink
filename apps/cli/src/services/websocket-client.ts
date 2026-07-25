import WebSocket from "ws";
import {
  MessageType,
  parseProtocolMessage,
  type CreateTunnelMessage,
  type ProtocolMessage,
  type TunnelCreatedMessage,
} from "@looplink/shared";
import { randomUUID } from "node:crypto";

import { ConnectionState } from "./connection-state.js";
import { rawDataToString } from "../utils/raw-data.js";

/**
 * Configuration for {@link LoopLinkWebSocketClient}.
 */
export interface WebSocketClientOptions {
  /** WebSocket URL of the LoopLink server. */
  readonly url: string;
  /**
   * When `true`, the client retries after an unexpected disconnect.
   *
   * Kept `false` for now; the close-path is structured so a retry policy can be
   * dropped in later without reshaping the client.
   */
  readonly reconnect: boolean;
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
   * Closes the connection if one is open.
   */
  disconnect(): Promise<void>;

  /**
   * Returns the current connection lifecycle state.
   */
  getState(): ConnectionState;

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
   */
  createTunnel(port: number): Promise<TunnelCreatedMessage>;
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
 * WebSocket client that maintains a single connection to the LoopLink server.
 */
export class LoopLinkWebSocketClient implements ServerConnection {
  private state: ConnectionState = ConnectionState.Disconnected;
  private socket: WebSocket | undefined;
  private readonly inbox: ProtocolMessage[] = [];
  private waiter: MessageWaiter | undefined;

  /**
   * @param options - Connection URL and reconnect policy.
   */
  constructor(private readonly options: WebSocketClientOptions) {}

  /**
   * Returns the current connection lifecycle state.
   *
   * @returns The latest {@link ConnectionState}.
   */
  getState(): ConnectionState {
    return this.state;
  }

  /**
   * Opens a WebSocket to the configured server URL.
   *
   * @returns A promise that resolves on a successful handshake.
   * @throws Error When the handshake fails or the socket closes before opening.
   */
  connect(): Promise<void> {
    if (this.state === ConnectionState.Connected) {
      return Promise.resolve();
    }

    if (this.state === ConnectionState.Connecting) {
      return Promise.reject(new Error("A connection attempt is already in progress."));
    }

    this.setState(ConnectionState.Connecting);

    return new Promise<void>((resolve, reject) => {
      const socket = new WebSocket(this.options.url);
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

      const onClose = (): void => {
        cleanup();
        this.disposeSocket();
        this.setState(ConnectionState.Disconnected);
        reject(new Error(`Failed to connect to ${this.options.url}.`));
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
   * Closes the active WebSocket, if any.
   *
   * @returns A promise that resolves once the socket has closed.
   */
  disconnect(): Promise<void> {
    const socket = this.socket;

    if (socket === undefined || this.state === ConnectionState.Disconnected) {
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
      throw new Error("Cannot send: not connected to the LoopLink server.");
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
   * @returns The server's {@link TunnelCreatedMessage}.
   */
  async createTunnel(port: number): Promise<TunnelCreatedMessage> {
    const requestId = randomUUID();
    const request: CreateTunnelMessage = {
      type: MessageType.CreateTunnel,
      requestId,
      port,
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

    return response;
  }

  private bindRuntimeHandlers(socket: WebSocket): void {
    socket.on("close", () => {
      this.failWaiter(new Error("Connection closed while waiting for a protocol message."));
      this.disposeSocket();
      this.setState(ConnectionState.Disconnected);
      this.maybeReconnect();
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

  private deliver(message: ProtocolMessage): void {
    const waiter = this.waiter;

    if (waiter?.match(message) === true) {
      waiter.resolve(message);
      return;
    }

    this.inbox.push(message);
  }

  private failWaiter(error: Error): void {
    if (this.waiter === undefined) {
      return;
    }

    this.waiter.reject(error);
  }

  private maybeReconnect(): void {
    if (!this.options.reconnect) {
      return;
    }

    // Automatic reconnect is intentionally disabled for now.
  }

  private disposeSocket(): void {
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
