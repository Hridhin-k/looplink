import { APP_DISPLAY_NAME, MessageType } from "@looplink/shared";

import type { Writer } from "../utils/output.js";
import type { ServerConnection } from "./websocket-client.js";

/**
 * Creates a {@link ServerConnection} for a given server WebSocket URL.
 */
export type ServerConnectionFactory = (serverUrl: string) => ServerConnection;

/**
 * Application service that starts a LoopLink session for a local port.
 *
 * Connects to the server, waits for the protocol handshake, requests a tunnel,
 * and prints the assigned public URL. HTTP forwarding is not implemented yet.
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
   * @param port - Already-validated local port to expose.
   * @param serverUrl - WebSocket URL of the LoopLink server.
   */
  async start(port: number, serverUrl: string): Promise<void> {
    this.writer.writeLine(`Starting ${APP_DISPLAY_NAME} on port ${String(port)}...`);

    const connection = this.createConnection(serverUrl);

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
