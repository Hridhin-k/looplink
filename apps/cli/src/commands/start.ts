import type { Command } from "commander";

import { DEFAULT_SERVER_URL, resolveServerUrl } from "../config/server.js";
import type { StartTunnelService } from "../services/start-tunnel.js";
import type { Writer } from "../utils/output.js";
import { parsePort } from "../utils/port.js";

/**
 * Options accepted by the start command after Commander parsing.
 */
export interface StartCommandOptions {
  /** Optional WebSocket URL override from `--server`. */
  readonly server?: string;
}

/**
 * Commander adapter for `looplink <port>`.
 *
 * Validates the port argument and delegates to {@link StartTunnelService}.
 */
export class StartCommand {
  /**
   * @param startTunnel - Application service that starts a session.
   * @param writer - Destination for validation errors.
   */
  constructor(
    private readonly startTunnel: StartTunnelService,
    private readonly writer: Writer,
  ) {}

  /**
   * Handles a single `looplink <port>` invocation.
   *
   * @param portArg - Raw port argument from the command line.
   * @param options - Parsed Commander options, including an optional server URL.
   */
  async execute(portArg: string, options: StartCommandOptions = {}): Promise<void> {
    const parsed = parsePort(portArg);

    if (!parsed.ok) {
      this.writer.writeError(parsed.error);
      process.exitCode = 1;
      return;
    }

    const serverUrl = resolveServerUrl(options.server);
    await this.startTunnel.start(parsed.value, serverUrl);
  }
}

/**
 * Registers the default `looplink <port>` action on a Commander program.
 *
 * @param program - Commander program to configure.
 * @param startCommand - Command handler to invoke for the port argument.
 */
export function registerStartCommand(program: Command, startCommand: StartCommand): void {
  program
    .argument("<port>", "Local TCP port to expose")
    .option("-s, --server <url>", `LoopLink server WebSocket URL (default: ${DEFAULT_SERVER_URL})`)
    .action((portArg: string, options: StartCommandOptions) => {
      void startCommand.execute(portArg, options);
    });
}
