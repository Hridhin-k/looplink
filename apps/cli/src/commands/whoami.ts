import type { Command } from "commander";
import boxen from "boxen";

import { DEFAULT_SERVER_URL, resolveServerUrl } from "../config/server.js";
import { AuthSessionManager } from "../services/auth-session-manager.js";
import { type CliAuthApiClient } from "../services/cli-auth-api-client.js";
import {
  findPersonalWorkspace,
  workspaceDisplayName,
} from "../services/workspace-labels.js";
import { WorkspacePreferenceStore } from "../services/workspace-preference-store.js";
import { createSpinner } from "../ui/spinner.js";
import { formatFriendlyError } from "../ui/formatters/errors.js";
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
    private readonly preferences: WorkspacePreferenceStore = new WorkspacePreferenceStore(),
  ) {}

  async execute(options: WhoAmICommandOptions = {}): Promise<void> {
    const serverUrl = resolveServerUrl(options.server);
    const spinner = createSpinner(this.writer, process.stderr.isTTY);

    try {
      const token = await this.sessions.getValidAccessToken(serverUrl);
      if (token === undefined) {
        this.writer.writeError(
          theme.warning("Not logged in.\nRun: badger login"),
        );
        process.exitCode = 1;
        return;
      }

      spinner.start("Fetching identity...");
      const me = await this.authApi.whoami(serverUrl, token);
      const memberships = await this.authApi.listWorkspaces(serverUrl, token).catch(() => []);
      spinner.stop();

      const preferredId = this.preferences.load(serverUrl)?.workspaceId;
      const current =
        (preferredId === undefined
          ? undefined
          : memberships.find((row) => row.workspace.id === preferredId)) ??
        findPersonalWorkspace(memberships);

      if (current !== undefined && preferredId === undefined) {
        this.preferences.save(serverUrl, current.workspace.id, workspaceDisplayName(current));
      }

      const email = me.email ?? "(none)";
      const name = displayNameFromEmail(me.email) ?? me.id.slice(0, 8);
      const avatar = initialsAvatar(name);

      const lines = [
        theme.heading(`${avatar}  ${name}`),
        `${theme.label("Email")}       ${email}`,
        `${theme.label("User id")}     ${theme.muted(me.id)}`,
        `${theme.label("Auth")}        ${me.authMethod === "api_key" ? "API key" : "JWT"}`,
        `${theme.label("Workspace")}   ${
          current !== undefined
            ? `${theme.highlight(workspaceDisplayName(current))} (${theme.muted(current.role)})`
            : theme.muted("(none)")
        }`,
        `${theme.label("Workspaces")}  ${String(memberships.length)}`,
      ].join("\n");

      this.writer.writeLine(
        boxen(lines, {
          padding: 1,
          borderStyle: "single",
          borderColor: "cyan",
          dimBorder: true,
        }),
      );
    } catch (error: unknown) {
      spinner.stop();
      this.writer.writeError(theme.error(formatFriendlyError(error)));
      process.exitCode = 1;
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

function initialsAvatar(name: string): string {
  const parts = name.trim().split(/[\s._-]+/).filter((p) => p.length > 0);
  const initials =
    parts.length >= 2
      ? `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase()
      : name.slice(0, 2).toUpperCase();
  return theme.highlight(`[${initials}]`);
}

export function registerWhoAmICommand(program: Command, whoami: WhoAmICommand): void {
  program
    .command("whoami")
    .description("Show the authenticated user and active workspace")
    .addHelpText(
      "after",
      `
Examples:
  $ badger whoami

Related:
  badger status
  badger workspace
`,
    )
    .option("-s, --server <url>", `Badger server WebSocket URL (default: ${DEFAULT_SERVER_URL})`)
    .action((options: WhoAmICommandOptions) => {
      void whoami.execute(options);
    });
}
