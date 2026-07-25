import { APP_DISPLAY_NAME } from "@looplink/shared";

import type { Writer } from "../utils/output.js";
import type { ServerConnection } from "./websocket-client.js";

/**
 * Creates a {@link ServerConnection} for a given server WebSocket URL.
 */
export type ServerConnectionFactory = (serverUrl: string) => ServerConnection;

/**
 * Application service that starts a LoopLink session for a local port.
 *
 * Connects to the server over WebSocket. Tunnel creation is intentionally
 * omitted for now.
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
   * Prints the start banner, opens a WebSocket to the LoopLink server, then
   * confirms the connection. Does not request a tunnel.
   *
   * @param port - Already-validated local port to expose later.
   * @param serverUrl - WebSocket URL of the LoopLink server.
   */
  async start(port: number, serverUrl: string): Promise<void> {
    this.writer.writeLine(`Starting ${APP_DISPLAY_NAME} on port ${String(port)}...`);

    const connection = this.createConnection(serverUrl);

    try {
      await connection.connect();
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Unknown connection error.";
      this.writer.writeError(`Failed to connect to ${APP_DISPLAY_NAME} server: ${message}`);
      process.exitCode = 1;
      return;
    }

    this.writer.writeLine(`Connected to ${APP_DISPLAY_NAME} server.`);
  }
}
