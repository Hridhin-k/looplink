import type { Command } from "commander";

import { DEFAULT_SERVER_URL, resolveServerUrl } from "../config/server.js";
import { AuthSessionManager } from "../services/auth-session-manager.js";
import {
  CliAuthApiClient,
  type CliWorkspaceMembership,
} from "../services/cli-auth-api-client.js";
import {
  findPersonalWorkspace,
  findWorkspaceByRef,
  workspaceDisplayName,
} from "../services/workspace-labels.js";
import { WorkspacePreferenceStore } from "../services/workspace-preference-store.js";
import { formatSuccessLine } from "../ui/formatters/boxes.js";
import { formatFriendlyError } from "../ui/formatters/errors.js";
import { promptSelect } from "../ui/prompts/select.js";
import { createSpinner } from "../ui/spinner.js";
import {
  formatWorkspaceTable,
  workspacePickerHint,
} from "../ui/tables/workspaces.js";
import { theme } from "../ui/theme.js";
import type { Writer } from "../utils/output.js";

/**
 * `badger workspace` — list / use / interactive switch.
 *
 * Workspace selection is independent of authentication tokens.
 */
export class WorkspaceCommand {
  constructor(
    private readonly authApi: CliAuthApiClient,
    private readonly sessions: AuthSessionManager,
    private readonly preferences: WorkspacePreferenceStore,
    private readonly writer: Writer,
  ) {}

  /**
   * Default `badger workspace` — interactive picker (TTY) or list (non-TTY).
   */
  async show(options: { readonly server?: string }): Promise<void> {
    const serverUrl = resolveServerUrl(options.server);
    await this.promptAndPersist(serverUrl);
  }

  async list(options: { readonly server?: string }): Promise<void> {
    const serverUrl = resolveServerUrl(options.server);
    const { memberships, current } = await this.loadMemberships(serverUrl);

    if (memberships.length === 0) {
      this.writer.writeLine(theme.info("No workspaces found for this account."));
      return;
    }

    this.writer.writeLine(
      `${theme.label("Active")}  ${
        current !== undefined
          ? theme.highlight(workspaceDisplayName(current))
          : theme.muted("(none)")
      }`,
    );
    this.writer.writeLine("");
    this.writer.writeLine(formatWorkspaceTable(memberships, current?.workspace.id));
    this.writer.writeLine("");
    this.writer.writeLine(theme.muted("● = active workspace (persisted locally)"));
  }

  async use(
    workspaceRef: string | undefined,
    options: { readonly server?: string },
  ): Promise<void> {
    const serverUrl = resolveServerUrl(options.server);
    const { memberships, current } = await this.loadMemberships(serverUrl);

    if (memberships.length === 0) {
      throw new Error("No workspaces found for this account.");
    }

    if (workspaceRef !== undefined && workspaceRef.trim().length > 0) {
      const match = findWorkspaceByRef(memberships, workspaceRef);
      if (match === undefined) {
        throw new Error(
          `Workspace "${workspaceRef}" not found for this account.\nRun: badger workspace`,
        );
      }
      this.persist(serverUrl, match);
      return;
    }

    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      throw new Error(
        "Interactive workspace selection requires a TTY. Pass a workspace name: `badger workspace use <name>`.",
      );
    }

    await this.chooseAndPersist(serverUrl, memberships, current?.workspace.id);
  }

  /**
   * Interactive picker used after login and by `badger workspace` / `use`.
   */
  async promptAndPersist(serverUrl: string): Promise<CliWorkspaceMembership | undefined> {
    const { memberships, current } = await this.loadMemberships(serverUrl);
    if (memberships.length === 0) {
      this.writer.writeLine(theme.info("No workspaces found for this account."));
      return undefined;
    }

    if (!process.stdin.isTTY || !process.stdout.isTTY) {
      this.printCurrent(current);
      this.writer.writeLine(formatWorkspaceTable(memberships, current?.workspace.id));
      return current;
    }

    return this.chooseAndPersist(serverUrl, memberships, current?.workspace.id);
  }

  /**
   * Ensures a current workspace preference exists (defaults to Personal).
   */
  async ensureDefaultPreference(serverUrl: string): Promise<CliWorkspaceMembership | undefined> {
    const token = await this.sessions.getValidAccessToken(serverUrl);
    if (token === undefined) {
      return undefined;
    }

    const memberships = await this.authApi.listWorkspaces(serverUrl, token);
    if (memberships.length === 0) {
      return undefined;
    }

    const existingId = this.preferences.load(serverUrl)?.workspaceId;
    if (existingId !== undefined) {
      const existing = memberships.find((row) => row.workspace.id === existingId);
      if (existing !== undefined) {
        return existing;
      }
    }

    const personal = findPersonalWorkspace(memberships) ?? memberships[0];
    if (personal === undefined) {
      return undefined;
    }

    this.preferences.save(serverUrl, personal.workspace.id, workspaceDisplayName(personal));
    return personal;
  }

  private async loadMemberships(serverUrl: string): Promise<{
    readonly memberships: readonly CliWorkspaceMembership[];
    readonly current: CliWorkspaceMembership | undefined;
  }> {
    const token = await this.sessions.getValidAccessToken(serverUrl);
    if (token === undefined) {
      throw new Error("Not logged in. Run `badger login` first.");
    }

    const spinner = createSpinner(this.writer, process.stderr.isTTY);
    spinner.start("Fetching workspaces...");
    let memberships: CliWorkspaceMembership[];
    try {
      memberships = await this.authApi.listWorkspaces(serverUrl, token);
    } finally {
      spinner.stop();
    }

    const preferredId = this.preferences.load(serverUrl)?.workspaceId;
    let current =
      preferredId === undefined
        ? undefined
        : memberships.find((row) => row.workspace.id === preferredId);

    if (current === undefined) {
      current = await this.ensureDefaultPreference(serverUrl);
    }

    return { memberships, current };
  }

  private async chooseAndPersist(
    serverUrl: string,
    memberships: readonly CliWorkspaceMembership[],
    currentId: string | undefined,
  ): Promise<CliWorkspaceMembership | undefined> {
    const selectedId = await promptSelect({
      message: "Select your active workspace",
      choices: memberships.map((row) => ({
        label: workspaceDisplayName(row),
        value: row.workspace.id,
        hint: workspacePickerHint(row),
      })),
      ...(currentId !== undefined ? { initialValue: currentId } : {}),
    });

    if (selectedId === undefined) {
      this.writer.writeLine(theme.muted("Workspace unchanged."));
      return memberships.find((row) => row.workspace.id === currentId);
    }

    const match = memberships.find((row) => row.workspace.id === selectedId);
    if (match === undefined) {
      throw new Error("Selected workspace was not found.\nRun: badger workspace");
    }

    this.persist(serverUrl, match);
    return match;
  }

  private persist(serverUrl: string, match: CliWorkspaceMembership): void {
    const label = workspaceDisplayName(match);
    this.preferences.save(serverUrl, match.workspace.id, label);
    this.writer.writeLine("");
    this.writer.writeLine(formatSuccessLine("Active workspace"));
    this.writer.writeLine(theme.heading(label));
  }

  private printCurrent(current: CliWorkspaceMembership | undefined): void {
    if (current === undefined) {
      this.writer.writeLine(`${theme.label("Active")}  ${theme.muted("(none)")}`);
      return;
    }
    this.writer.writeLine(
      `${theme.label("Active")}  ${theme.highlight(workspaceDisplayName(current))}`,
    );
  }
}

export function registerWorkspaceCommand(program: Command, command: WorkspaceCommand): void {
  const workspace = program
    .command("workspace")
    .description("Show or switch the active workspace (independent of login)")
    .addHelpText(
      "after",
      `
Examples:
  $ badger workspace
  $ badger workspace list
  $ badger workspace use
  $ badger workspace use personal

Related:
  badger login
  badger whoami
  badger status
`,
    )
    .option("-s, --server <url>", "Badger server WebSocket URL", DEFAULT_SERVER_URL)
    .action(async (options: { server?: string }) => {
      try {
        await command.show(options);
      } catch (error: unknown) {
        console.error(theme.error(formatFriendlyError(error)));
        process.exitCode = 1;
      }
    });

  workspace
    .command("list")
    .description("List workspaces for the authenticated account")
    .option("-s, --server <url>", "Badger server WebSocket URL", DEFAULT_SERVER_URL)
    .action(async (options: { server?: string }) => {
      try {
        await command.list(options);
      } catch (error: unknown) {
        console.error(theme.error(formatFriendlyError(error)));
        process.exitCode = 1;
      }
    });

  workspace
    .command("use")
    .description("Set the current workspace (interactive menu, or pass name)")
    .argument("[workspace]", 'Workspace id, name, or "personal" (omit for interactive menu)')
    .option("-s, --server <url>", "Badger server WebSocket URL", DEFAULT_SERVER_URL)
    .action(async (workspaceRef: string | undefined, options: { server?: string }) => {
      try {
        await command.use(workspaceRef, options);
      } catch (error: unknown) {
        console.error(theme.error(formatFriendlyError(error)));
        process.exitCode = 1;
      }
    });
}
