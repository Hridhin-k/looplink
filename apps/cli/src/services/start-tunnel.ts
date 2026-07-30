import { MessageType } from "@hridhin-k/badger-shared";

import { LocalProxy } from "./local-proxy.js";
import { RequestForwarder } from "./request-forwarder.js";
import type { ShutdownRegistry } from "./shutdown.js";
import type { ServerConnection, WebSocketClientOptions } from "./websocket-client.js";
import { BadgerWebSocketClient } from "./websocket-client.js";
import type { SessionPresenter } from "../ui/session-presenter.js";

/**
 * Creates a {@link ServerConnection} for a given server WebSocket URL.
 */
export type ServerConnectionFactory = (
  serverUrl: string,
  options?: Partial<WebSocketClientOptions>,
) => ServerConnection;

/**
 * Application service that starts a Badger session for a local port.
 *
 * Connects to the server, waits for the protocol handshake, requests a tunnel,
 * and keeps the session alive. Unexpected disconnects are retried automatically
 * when the connection factory enables reconnect.
 */
export class StartTunnelService {
  /**
   * @param presenter - User-facing view of the session lifecycle.
   * @param createConnection - Factory that builds a server connection for a URL.
   * @param shutdown - Registry used to close the connection on Ctrl+C.
   */
  constructor(
    private readonly presenter: SessionPresenter,
    private readonly createConnection: ServerConnectionFactory,
    private readonly shutdown: ShutdownRegistry,
  ) {}

  /**
   * Begins a session for the given local TCP port.
   *
   * On success the promise resolves after the tunnel is created; the underlying
   * connection stays open and continues reconnecting until the process exits or
   * {@link ServerConnection.disconnect} is called.
   *
   * @param port - Already-validated local port to expose.
   * @param serverUrl - WebSocket URL of the Badger server.
   */
  async start(
    port: number,
    serverUrl: string,
    options: {
      readonly getAuthToken?: () => Promise<string | undefined>;
      readonly getWorkspaceId?: () => Promise<string | undefined>;
    } = {},
  ): Promise<void> {
    this.presenter.starting(port);

    const connection = this.createConnection(serverUrl, {
      ...(options.getAuthToken === undefined ? {} : { getAuthToken: options.getAuthToken }),
      ...(options.getWorkspaceId === undefined ? {} : { getWorkspaceId: options.getWorkspaceId }),
      onConnectionLost: () => {
        this.presenter.connectionLost();
      },
      onReconnectFailed: (error) => {
        this.presenter.reconnectFailed(error);
      },
      onReconnected: (tunnel, restored) => {
        this.present(this.presenter.reconnected({ publicUrl: tunnel.publicUrl, port, restored }));
      },
    });

    // Registered before the tunnel exists so no request frame can race past
    // the handler; the forwarder survives reconnects along with the client.
    const forwarder = new RequestForwarder(port, new LocalProxy(), (message) => {
      connection.send(message);
    });
    connection.setForwardingHandler((message) => {
      forwarder.handle(message);
    });

    this.shutdown.register(async () => {
      await connection.disconnect();
    });

    try {
      await connection.connect();

      await connection.waitForMessage((message) => message.type === MessageType.Connected);

      this.presenter.connected();

      const created = await connection.createTunnel(port);

      await this.presenter.tunnelReady({
        publicUrl: created.publicUrl,
        port,
        restored: false,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown connection error.";
      this.presenter.failed(message);
      process.exitCode = 1;

      try {
        await connection.disconnect();
      } catch {
        // Best-effort cleanup after a failed session.
      }
    }
  }

  /**
   * Consumes a presenter promise from a synchronous callback.
   *
   * Rendering must never surface as an unhandled rejection that tears down a
   * healthy tunnel.
   *
   * @param rendering - Pending presenter work.
   */
  private present(rendering: Promise<void>): void {
    void rendering.catch(() => {
      // Presentation is best-effort; the session continues regardless.
    });
  }
}

/**
 * Default factory used by the CLI entrypoint.
 *
 * @param serverUrl - WebSocket URL of the Badger server.
 * @param options - Optional overrides such as reconnect callbacks.
 * @returns A reconnect-enabled WebSocket client.
 */
export function createDefaultServerConnection(
  serverUrl: string,
  options: Partial<WebSocketClientOptions> = {},
): ServerConnection {
  return new BadgerWebSocketClient({
    url: serverUrl,
    reconnect: true,
    ...options,
  });
}
