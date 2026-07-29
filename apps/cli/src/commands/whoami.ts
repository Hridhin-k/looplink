import type { Command } from "commander";

import { DEFAULT_SERVER_URL, resolveServerUrl } from "../config/server.js";
import { AuthSessionManager } from "../services/auth-session-manager.js";
import { type CliAuthApiClient } from "../services/cli-auth-api-client.js";
import { theme } from "../ui/theme.js";
import type { Writer } from "../utils/output.js";

export interface WhoAmICommandOptions {
  readonly server?: string;
}

export class WhoAmICommand {
  constructor(
    private readonly authApi: CliAuthApiClient,
    private readonly sessions: AuthSessionManager,
    private readonly writer: Writer,
  ) {}

  async execute(options: WhoAmICommandOptions = {}): Promise<void> {
    const serverUrl = resolveServerUrl(options.server);

    try {
      const token = await this.sessions.getValidAccessToken(serverUrl);
      if (token === undefined) {
        this.writer.writeError(theme.warning("Not logged in. Run `badger login` first."));
        process.exitCode = 1;
        return;
      }

      const me = await this.authApi.whoami(serverUrl, token);
      this.writer.writeLine(`id: ${me.id}`);
      this.writer.writeLine(`email: ${me.email ?? "(none)"}`);
      if (me.authMethod === "api_key") {
        this.writer.writeLine(`auth: api_key`);
        if (me.workspaceId) {
          this.writer.writeLine(`workspace: ${me.workspaceId}`);
        }
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.writer.writeError(theme.error(message));
      process.exitCode = 1;
    }
  }
}

export function registerWhoAmICommand(program: Command, whoami: WhoAmICommand): void {
  program
    .command("whoami")
    .description("Show the authenticated user")
    .option("-s, --server <url>", `Badger server WebSocket URL (default: ${DEFAULT_SERVER_URL})`)
    .action((options: WhoAmICommandOptions) => {
      void whoami.execute(options);
    });
}
