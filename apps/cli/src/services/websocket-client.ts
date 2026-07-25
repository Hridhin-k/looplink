import WebSocket from "ws";

import { ConnectionState } from "./connection-state.js";

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
}

/**
 * WebSocket client that maintains a single connection to the LoopLink server.
 */
export class LoopLinkWebSocketClient implements ServerConnection {
  private state: ConnectionState = ConnectionState.Disconnected;
  private socket: WebSocket | undefined;

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

      const cleanup = (): void => {
        socket.off("open", onOpen);
        socket.off("error", onError);
        socket.off("close", onClose);
      };

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

  private bindRuntimeHandlers(socket: WebSocket): void {
    socket.on("close", () => {
      this.disposeSocket();
      this.setState(ConnectionState.Disconnected);
      this.maybeReconnect();
    });

    socket.on("error", () => {
      // `close` always follows `error` for `ws`; reconnect is decided there.
    });
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
  }

  private setState(state: ConnectionState): void {
    this.state = state;
  }
}
