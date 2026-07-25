import type { Command } from "commander";

import type { StartTunnelService } from "../services/start-tunnel.js";
import type { Writer } from "../utils/output.js";
import { parsePort } from "../utils/port.js";

/**
 * Commander adapter for `looplink <port>`.
 *
 * Validates the port argument and delegates to {@link StartTunnelService}.
 */
export class StartCommand {
  /**
   * @param startTunnel - Application service that starts a tunnel.
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
   */
  execute(portArg: string): void {
    const parsed = parsePort(portArg);

    if (!parsed.ok) {
      this.writer.writeError(parsed.error);
      process.exitCode = 1;
      return;
    }

    this.startTunnel.start(parsed.value);
  }
}

/**
 * Registers the default `looplink <port>` action on a Commander program.
 *
 * @param program - Commander program to configure.
 * @param startCommand - Command handler to invoke for the port argument.
 */
export function registerStartCommand(program: Command, startCommand: StartCommand): void {
  program.argument("<port>", "Local TCP port to expose").action((portArg: string) => {
    startCommand.execute(portArg);
  });
}
