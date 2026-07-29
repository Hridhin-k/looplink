import type { Command } from "commander";

import { DEFAULT_SERVER_URL, resolveServerUrl } from "../config/server.js";
import { type CliAuthApiClient } from "../services/cli-auth-api-client.js";
import { AuthSessionManager } from "../services/auth-session-manager.js";
import { theme } from "../ui/theme.js";
import type { Writer } from "../utils/output.js";

export interface LogoutCommandOptions {
  readonly server?: string;
}

export class LogoutCommand {
  constructor(
    private readonly authApi: CliAuthApiClient,
    private readonly sessions: AuthSessionManager,
    private readonly writer: Writer,
  ) {}

  async execute(options: LogoutCommandOptions = {}): Promise<void> {
    const serverUrl = resolveServerUrl(options.server);
    const session = this.sessions.load(serverUrl);

    try {
      if (session?.authMethod === "jwt") {
        const token = await this.sessions.getValidAccessToken(serverUrl);
        if (token !== undefined) {
          await this.authApi.logout(serverUrl, token);
        }
      }
      this.sessions.clear();
      this.writer.writeLine(theme.success("Logged out."));
    } catch (error: unknown) {
      this.sessions.clear();
      const message = error instanceof Error ? error.message : String(error);
      this.writer.writeError(theme.error(message));
      process.exitCode = 1;
    }
  }
}

export function registerLogoutCommand(program: Command, logoutCommand: LogoutCommand): void {
  program
    .command("logout")
    .description("Clear local auth session and revoke refresh tokens")
    .option("-s, --server <url>", `Badger server WebSocket URL (default: ${DEFAULT_SERVER_URL})`)
    .action((options: LogoutCommandOptions) => {
      void logoutCommand.execute(options);
    });
}
