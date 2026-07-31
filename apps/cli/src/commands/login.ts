import type { Command } from "commander";

import { DEFAULT_SERVER_URL, resolveServerUrl } from "../config/server.js";
import { type CliAuthApiClient } from "../services/cli-auth-api-client.js";
import { AuthSessionManager } from "../services/auth-session-manager.js";
import { runCliOAuthLogin } from "../services/cli-oauth-login.js";
import type { WorkspaceCommand } from "./workspace.js";
import { createSpinner } from "../ui/spinner.js";
import { animationsEnabled, playFrames } from "../ui/animations.js";
import { SPARKLE_FRAMES } from "../ui/drawings/mascot.js";
import { formatFriendlyError } from "../ui/formatters/errors.js";
import { formatSuccessLine } from "../ui/formatters/boxes.js";
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
    private readonly workspaces?: WorkspaceCommand,
  ) {}

  async execute(options: LoginCommandOptions = {}): Promise<void> {
    const serverUrl = resolveServerUrl(options.server);
    const spinner = createSpinner(this.writer, process.stderr.isTTY);

    try {
      if (options.token !== undefined && options.token.trim().length > 0) {
        await this.loginWithToken(serverUrl, options.token.trim(), spinner);
        return;
      }

      spinner.start("Authenticating...");
      const oauth = await this.authApi.getOAuthConfig(serverUrl);
      spinner.stop();
      this.writer.writeLine(theme.info(`Opening browser for ${oauth.provider} OAuth…`));

      const result = await runCliOAuthLogin({
        supabaseUrl: oauth.supabaseUrl,
        supabaseAnonKey: oauth.supabaseAnonKey,
        provider: oauth.provider,
      });

      this.sessions.save(serverUrl, result.session);

      if (animationsEnabled()) {
        await playFrames(
          SPARKLE_FRAMES.map((frame) => theme.success(frame)),
          { intervalMs: 55, loops: 2 },
        );
      }

      const displayName = displayNameFromEmail(result.session.user.email) ?? "there";
      this.writer.writeLine("");
      this.writer.writeLine(formatSuccessLine("Successfully authenticated"));
      this.writer.writeLine(theme.muted("Welcome back,"));
      this.writer.writeLine(theme.heading(displayName));
      this.writer.writeLine("");
      this.writer.writeLine(theme.info("Workspace selection will begin."));
      this.writer.writeLine("");

      await this.selectWorkspaceAfterLogin(serverUrl);
    } catch (error: unknown) {
      spinner.stop();
      this.writer.writeError(theme.error(formatFriendlyError(error)));
      process.exitCode = 1;
    }
  }

  private async loginWithToken(
    serverUrl: string,
    token: string,
    spinner: ReturnType<typeof createSpinner>,
  ): Promise<void> {
    if (!token.startsWith(API_KEY_PREFIX)) {
      throw new Error(`API tokens must start with ${API_KEY_PREFIX}.`);
    }

    spinner.start("Authenticating with API key...");
    const me = await this.authApi.whoami(serverUrl, token);
    spinner.succeed(formatSuccessLine("Successfully authenticated"));

    this.sessions.saveApiKey(serverUrl, token, {
      id: me.id,
      email: me.email,
      ...(me.workspaceId === undefined ? {} : { workspaceId: me.workspaceId }),
      ...(me.apiKeyId === undefined ? {} : { apiKeyId: me.apiKeyId }),
    });

    this.writer.writeLine(theme.muted(`User id: ${me.id}`));
    if (me.workspaceId) {
      this.writer.writeLine(theme.muted(`Workspace: ${me.workspaceId}`));
    }

    await this.selectWorkspaceAfterLogin(serverUrl);
  }

  private async selectWorkspaceAfterLogin(serverUrl: string): Promise<void> {
    if (this.workspaces === undefined) {
      return;
    }
    try {
      await this.workspaces.promptAndPersist(serverUrl);
    } catch (error: unknown) {
      // Auth already succeeded; workspace picker is best-effort.
      this.writer.writeLine(theme.warning(formatFriendlyError(error)));
    }
  }
}

function displayNameFromEmail(email: string | null): string | undefined {
  if (email === null || email.trim().length === 0) {
    return undefined;
  }
  const local = email.split("@")[0]?.trim() ?? "";
  if (local.length === 0) {
    return undefined;
  }
  return local.charAt(0).toUpperCase() + local.slice(1);
}

export function registerLoginCommand(program: Command, loginCommand: LoginCommand): void {
  program
    .command("login")
    .description("Authenticate this CLI using browser OAuth or an API token")
    .addHelpText(
      "after",
      `
Examples:
  $ badger login
  $ badger login -s ws://localhost:8080
  $ badger login -t bgk_xxxxxxxx

Related:
  badger logout    Sign out
  badger workspace Switch workspace
  badger whoami    Show identity
`,
    )
    .option("-s, --server <url>", `Badger server WebSocket URL (default: ${DEFAULT_SERVER_URL})`)
    .option("-t, --token <apiKey>", "Workspace API key for CI/CD (skips browser login)")
    .action((options: LoginCommandOptions) => {
      void loginCommand.execute(options);
    });
}
