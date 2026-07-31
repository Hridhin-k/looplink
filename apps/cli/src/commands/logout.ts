import type { Command } from "commander";

import { DEFAULT_SERVER_URL, resolveServerUrl } from "../config/server.js";
import { type CliAuthApiClient } from "../services/cli-auth-api-client.js";
import { AuthSessionManager } from "../services/auth-session-manager.js";
import { formatFriendlyError } from "../ui/formatters/errors.js";
import { formatSuccessLine } from "../ui/formatters/boxes.js";
import { promptConfirm } from "../ui/prompts/select.js";
import { theme } from "../ui/theme.js";
import type { Writer } from "../utils/output.js";

export interface LogoutCommandOptions {
  readonly server?: string;
  readonly yes?: boolean;
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

    if (session === undefined) {
      this.writer.writeLine(theme.info("You are not logged in."));
      return;
    }

    if (options.yes !== true) {
      const confirmed = await promptConfirm({
        message: "Are you sure you want to log out?",
        initialValue: false,
      });
      if (confirmed !== true) {
        this.writer.writeLine(theme.muted("Logout cancelled."));
        return;
      }
    }

    try {
      if (session.authMethod === "jwt") {
        const token = await this.sessions.getValidAccessToken(serverUrl);
        if (token !== undefined) {
          await this.authApi.logout(serverUrl, token);
        }
      }
      this.sessions.clear();
      this.writer.writeLine(formatSuccessLine("Logged out successfully."));
    } catch (error: unknown) {
      this.sessions.clear();
      this.writer.writeError(theme.error(formatFriendlyError(error)));
      process.exitCode = 1;
    }
  }
}

export function registerLogoutCommand(program: Command, logoutCommand: LogoutCommand): void {
  program
    .command("logout")
    .description("Clear local auth session and revoke refresh tokens")
    .addHelpText(
      "after",
      `
Examples:
  $ badger logout
  $ badger logout --yes

Related:
  badger login
  badger whoami
`,
    )
    .option("-s, --server <url>", `Badger server WebSocket URL (default: ${DEFAULT_SERVER_URL})`)
    .option("-y, --yes", "Skip confirmation prompt")
    .action((options: LogoutCommandOptions) => {
      void logoutCommand.execute(options);
    });
}
