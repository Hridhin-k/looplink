import { APP_DISPLAY_NAME, MessageType } from "@looplink/shared";

import type { Writer } from "../utils/output.js";
import type { ServerConnection, WebSocketClientOptions } from "./websocket-client.js";
import { LoopLinkWebSocketClient } from "./websocket-client.js";

/**
 * Creates a {@link ServerConnection} for a given server WebSocket URL.
 */
export type ServerConnectionFactory = (
  serverUrl: string,
  options?: Partial<WebSocketClientOptions>,
) => ServerConnection;

/**
 * Application service that starts a LoopLink session for a local port.
 *
 * Connects to the server, waits for the protocol handshake, requests a tunnel,
 * and keeps the session alive. Unexpected disconnects are retried automatically
 * when the connection factory enables reconnect.
 */
export class StartTunnelService {
  /**
   * @param writer - Destination for progress and error messages.
   * @param createConnection - Factory that builds a server connection for a URL.
   */
  constructor(
    private readonly writer: Writer,
    private readonly createConnection: ServerConnectionFactory,
  ) {}

  /**
   * Begins a session for the given local TCP port.
   *
   * On success the promise resolves after the tunnel is created; the underlying
   * connection stays open and continues reconnecting until the process exits or
   * {@link ServerConnection.disconnect} is called.
   *
   * @param port - Already-validated local port to expose.
   * @param serverUrl - WebSocket URL of the LoopLink server.
   */
  async start(port: number, serverUrl: string): Promise<void> {
    this.writer.writeLine(`Starting ${APP_DISPLAY_NAME} on port ${String(port)}...`);

    const connection = this.createConnection(serverUrl, {
      onConnectionLost: () => {
        this.writer.writeError(`Connection lost. Reconnecting to ${APP_DISPLAY_NAME} server...`);
      },
      onReconnectFailed: (error) => {
        this.writer.writeError(`Reconnect failed: ${error.message}`);
      },
      onReconnected: (tunnel, restored) => {
        if (restored) {
          this.writer.writeLine("Reconnected. Tunnel restored.");
        } else {
          this.writer.writeLine("Reconnected. Tunnel Created");
        }
        this.writer.writeLine("");
        this.writer.writeLine(tunnel.publicUrl);
      },
    });

    try {
      await connection.connect();

      await connection.waitForMessage((message) => message.type === MessageType.Connected);

      this.writer.writeLine(`Connected to ${APP_DISPLAY_NAME} server.`);

      const created = await connection.createTunnel(port);

      this.writer.writeLine("Tunnel Created");
      this.writer.writeLine("");
      this.writer.writeLine(created.publicUrl);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown connection error.";
      this.writer.writeError(`Failed to create tunnel: ${message}`);
      process.exitCode = 1;

      try {
        await connection.disconnect();
      } catch {
        // Best-effort cleanup after a failed session.
      }
    }
  }
}

/**
 * Default factory used by the CLI entrypoint.
 *
 * @param serverUrl - WebSocket URL of the LoopLink server.
 * @param options - Optional overrides such as reconnect callbacks.
 * @returns A reconnect-enabled WebSocket client.
 */
export function createDefaultServerConnection(
  serverUrl: string,
  options: Partial<WebSocketClientOptions> = {},
): ServerConnection {
  return new LoopLinkWebSocketClient({
    url: serverUrl,
    reconnect: true,
    ...options,
  });
}
