import type { Command } from "commander";

import { DEFAULT_SERVER_URL, resolveServerUrl } from "../config/server.js";
import { type CliAuthApiClient } from "../services/cli-auth-api-client.js";
import { AuthSessionManager } from "../services/auth-session-manager.js";
import { runCliOAuthLogin } from "../services/cli-oauth-login.js";
import { theme } from "../ui/theme.js";
import type { Writer } from "../utils/output.js";

export interface LoginCommandOptions {
  readonly server?: string;
  readonly token?: string;
}

const API_KEY_PREFIX = "bgk_";

export class LoginCommand {
  constructor(
    private readonly authApi: CliAuthApiClient,
    private readonly sessions: AuthSessionManager,
    private readonly writer: Writer,
  ) {}

  async execute(options: LoginCommandOptions = {}): Promise<void> {
    const serverUrl = resolveServerUrl(options.server);

    try {
      if (options.token !== undefined && options.token.trim().length > 0) {
        await this.loginWithToken(serverUrl, options.token.trim());
        return;
      }

      const oauth = await this.authApi.getOAuthConfig(serverUrl);
      this.writer.writeLine(theme.muted(`Opening browser for ${oauth.provider} OAuth…`));
      const result = await runCliOAuthLogin({
        supabaseUrl: oauth.supabaseUrl,
        supabaseAnonKey: oauth.supabaseAnonKey,
        provider: oauth.provider,
      });

      this.sessions.save(serverUrl, result.session);
      this.writer.writeLine(theme.success("Logged in successfully."));
      this.writer.writeLine(`User: ${result.session.user.email ?? result.session.user.id}`);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.writer.writeError(theme.error(message));
      process.exitCode = 1;
    }
  }

  private async loginWithToken(serverUrl: string, token: string): Promise<void> {
    if (!token.startsWith(API_KEY_PREFIX)) {
      throw new Error(`API tokens must start with ${API_KEY_PREFIX}.`);
    }

    const me = await this.authApi.whoami(serverUrl, token);
    this.sessions.saveApiKey(serverUrl, token, {
      id: me.id,
      email: me.email,
      ...(me.workspaceId === undefined ? {} : { workspaceId: me.workspaceId }),
      ...(me.apiKeyId === undefined ? {} : { apiKeyId: me.apiKeyId }),
    });
    this.writer.writeLine(theme.success("Logged in with API key."));
    this.writer.writeLine(`User id: ${me.id}`);
    if (me.workspaceId) {
      this.writer.writeLine(`Workspace: ${me.workspaceId}`);
    }
  }
}

export function registerLoginCommand(program: Command, loginCommand: LoginCommand): void {
  program
    .command("login")
    .description("Authenticate this CLI using browser OAuth or an API token")
    .option("-s, --server <url>", `Badger server WebSocket URL (default: ${DEFAULT_SERVER_URL})`)
    .option("-t, --token <apiKey>", "Workspace API key for CI/CD (skips browser login)")
    .action((options: LoginCommandOptions) => {
      void loginCommand.execute(options);
    });
}
