import type { Command } from "commander";

import { DEFAULT_SERVER_URL, resolveServerUrl } from "../config/server.js";
import { AuthSessionManager } from "../services/auth-session-manager.js";
import { CliAuthApiClient } from "../services/cli-auth-api-client.js";
import { WorkspacePreferenceStore } from "../services/workspace-preference-store.js";
import type { Writer } from "../utils/output.js";

/**
 * `badger workspace list` / `badger workspace use` — independent of login tokens.
 */
export class WorkspaceCommand {
  constructor(
    private readonly authApi: CliAuthApiClient,
    private readonly sessions: AuthSessionManager,
    private readonly preferences: WorkspacePreferenceStore,
    private readonly writer: Writer,
  ) {}

  async list(options: { readonly server?: string }): Promise<void> {
    const serverUrl = resolveServerUrl(options.server);
    const token = await this.sessions.getValidAccessToken(serverUrl);
    if (token === undefined) {
      throw new Error("Not logged in. Run `badger login` first.");
    }

    const memberships = await this.authApi.listWorkspaces(serverUrl, token);
    const current = this.preferences.load(serverUrl)?.workspaceId;

    if (memberships.length === 0) {
      this.writer.writeLine("No workspaces found for this account.");
      return;
    }

    for (const row of memberships) {
      const marker = row.workspace.id === current ? "*" : " ";
      this.writer.writeLine(
        `${marker} ${row.workspace.name}  (${row.workspace.kind})  ${row.role}  ${row.workspace.id}`,
      );
    }
    this.writer.writeLine("");
    this.writer.writeLine("* = current workspace (persisted locally; does not change authentication)");
  }

  async use(workspaceRef: string, options: { readonly server?: string }): Promise<void> {
    const serverUrl = resolveServerUrl(options.server);
    const token = await this.sessions.getValidAccessToken(serverUrl);
    if (token === undefined) {
      throw new Error("Not logged in. Run `badger login` first.");
    }

    const memberships = await this.authApi.listWorkspaces(serverUrl, token);
    const needle = workspaceRef.trim().toLowerCase();
    const match = memberships.find(
      (row) =>
        row.workspace.id.toLowerCase() === needle ||
        row.workspace.name.toLowerCase() === needle,
    );
    if (match === undefined) {
      throw new Error(`Workspace "${workspaceRef}" not found for this account.`);
    }

    this.preferences.save(serverUrl, match.workspace.id, match.workspace.name);
    this.writer.writeLine(`Using workspace "${match.workspace.name}" (${match.workspace.id}).`);
  }
}

export function registerWorkspaceCommand(program: Command, command: WorkspaceCommand): void {
  const workspace = program.command("workspace").description("Manage active workspace context");

  workspace
    .command("list")
    .description("List workspaces for the authenticated account")
    .option("-s, --server <url>", "Badger server WebSocket URL", DEFAULT_SERVER_URL)
    .action(async (options: { server?: string }) => {
      await command.list(options);
    });

  workspace
    .command("use")
    .description("Set the current workspace (persisted locally; no re-login)")
    .argument("<workspace>", "Workspace id or name")
    .option("-s, --server <url>", "Badger server WebSocket URL", DEFAULT_SERVER_URL)
    .action(async (workspaceRef: string, options: { server?: string }) => {
      await command.use(workspaceRef, options);
    });
}
