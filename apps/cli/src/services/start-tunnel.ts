import { APP_DISPLAY_NAME } from "@looplink/shared";

import type { Writer } from "../utils/output.js";

/**
 * Application service that starts a LoopLink tunnel for a local port.
 *
 * Networking is intentionally omitted for now: the service only announces that
 * a tunnel is about to start, so the CLI surface can be validated end-to-end
 * before a real transport is wired in.
 */
export class StartTunnelService {
  /**
   * @param writer - Destination for progress messages.
   */
  constructor(private readonly writer: Writer) {}

  /**
   * Begins a tunnel session for the given local TCP port.
   *
   * @param port - Already-validated local port to expose.
   */
  start(port: number): void {
    this.writer.writeLine(`Starting ${APP_DISPLAY_NAME} on port ${String(port)}...`);
  }
}
