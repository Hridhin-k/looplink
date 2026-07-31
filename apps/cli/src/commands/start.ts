import type { Command } from "commander";

import { DEFAULT_SERVER_URL, resolveServerUrl } from "../config/server.js";
import { AnonymousSessionApiClient } from "../services/anonymous-session-api-client.js";
import { AuthSessionManager } from "../services/auth-session-manager.js";
import {
  CliAuthApiClient,
  type CliWorkspaceMembership,
} from "../services/cli-auth-api-client.js";
import type { ShutdownRegistry } from "../services/shutdown.js";
import type { StartTunnelService } from "../services/start-tunnel.js";
import {
  findPersonalWorkspace,
  findWorkspaceByRef,
  workspaceDisplayName,
} from "../services/workspace-labels.js";
import { WorkspacePreferenceStore } from "../services/workspace-preference-store.js";
import { ConsoleSessionPresenter } from "../ui/console-session-presenter.js";
import { formatAnonymousModeNotice } from "../ui/formatters/boxes.js";
import { formatFriendlyError } from "../ui/formatters/errors.js";
import { theme } from "../ui/theme.js";
import type { Writer } from "../utils/output.js";
import { parsePort } from "../utils/port.js";

/**
 * Options accepted by the start command after Commander parsing.
 */
export interface StartCommandOptions {
  /** Optional WebSocket URL override from `--server`. */
  readonly server?: string;
  /** Workspace id or exact name for tunnel ownership / traffic isolation. */
  readonly workspace?: string;
}

/**
 * Commander adapter for `badger <port>`.
 */
export class StartCommand {
  constructor(
    private readonly startTunnel: StartTunnelService,
    private readonly writer: Writer,
    private readonly sessions: AuthSessionManager,
    private readonly authApi: CliAuthApiClient,
    private readonly workspacePreferences: WorkspacePreferenceStore = new WorkspacePreferenceStore(),
    private readonly anonymousSessions: AnonymousSessionApiClient = new AnonymousSessionApiClient(),
    private readonly shutdown?: ShutdownRegistry,
    private readonly presenter?: ConsoleSessionPresenter,
  ) {}

  /**
   * Handles a single `badger <port>` invocation.
   */
  async execute(portArg: string, options: StartCommandOptions = {}): Promise<void> {
    const parsed = parsePort(portArg);

    if (!parsed.ok) {
      this.writer.writeError(theme.error(parsed.error));
      process.exitCode = 1;
      return;
    }

    const serverUrl = resolveServerUrl(options.server);

    try {
      const authToken = await this.sessions.getValidAccessToken(serverUrl);
      if (authToken !== undefined) {
        const resolved = await this.resolveWorkspace(serverUrl, options.workspace);
        this.presenter?.setSessionContext({
          mode: "workspace",
          ...(resolved === undefined
            ? {}
            : { workspaceLabel: workspaceDisplayName(resolved) }),
        });
        const workspaceId = resolved?.workspace.id;
        await this.startTunnel.start(parsed.value, serverUrl, {
          getAuthToken: async () => this.sessions.getValidAccessToken(serverUrl),
          ...(workspaceId === undefined
            ? {}
            : {
                getWorkspaceId: async () => workspaceId,
              }),
        });
        return;
      }

      if (options.workspace !== undefined && options.workspace.trim().length > 0) {
        throw new Error(
          `Workspace "${options.workspace.trim()}" requires login.\nRun: badger login -s ${serverUrl}`,
        );
      }

      this.writer.writeLine(formatAnonymousModeNotice());
      this.writer.writeLine("");

      this.presenter?.setSessionContext({
        mode: "anonymous",
        workspaceLabel: "Anonymous",
      });

      const anonymous = await this.anonymousSessions.create(serverUrl);

      this.shutdown?.register(async () => {
        await this.anonymousSessions.destroy(serverUrl, anonymous.token).catch(() => undefined);
      });

      await this.startTunnel.start(parsed.value, serverUrl, {
        getAnonymousSessionToken: async () => anonymous.token,
      });
    } catch (error: unknown) {
      this.writer.writeError(theme.error(formatFriendlyError(error)));
      process.exitCode = 1;
    }
  }

  private async resolveWorkspace(
    serverUrl: string,
    workspaceRef: string | undefined,
  ): Promise<CliWorkspaceMembership | undefined> {
    const token = await this.sessions.getValidAccessToken(serverUrl);
    if (token === undefined) {
      return undefined;
    }

    const memberships = await this.authApi.listWorkspaces(serverUrl, token);
    if (memberships.length === 0) {
      throw new Error("No workspaces found for this account.");
    }

    if (workspaceRef !== undefined && workspaceRef.trim().length > 0) {
      const match = findWorkspaceByRef(memberships, workspaceRef);
      if (match === undefined) {
        const names = memberships.map((m) => workspaceDisplayName(m)).join(", ");
        throw new Error(
          `Workspace "${workspaceRef.trim()}" not found for this account.` +
            (names.length > 0 ? `\nAvailable: ${names}` : "") +
            "\nRun: badger workspace",
        );
      }
      this.workspacePreferences.save(
        serverUrl,
        match.workspace.id,
        workspaceDisplayName(match),
      );
      return match;
    }

    const preferredId = this.workspacePreferences.load(serverUrl)?.workspaceId;
    if (preferredId !== undefined && preferredId.length > 0) {
      const preferred = memberships.find((row) => row.workspace.id === preferredId);
      if (preferred !== undefined) {
        return preferred;
      }
    }

    const personal = findPersonalWorkspace(memberships) ?? memberships[0];
    if (personal === undefined) {
      return undefined;
    }

    this.workspacePreferences.save(
      serverUrl,
      personal.workspace.id,
      workspaceDisplayName(personal),
    );
    return personal;
  }
}

/**
 * Registers the default `badger [port]` action on a Commander program.
 *
 * When port is omitted, invokes {@link onNoPort} (interactive root menu).
 */
export function registerStartCommand(
  program: Command,
  startCommand: StartCommand,
  hooks: { readonly onNoPort: () => Promise<void> } = {
    onNoPort: async () => undefined,
  },
): void {
  program
    .argument("[port]", "Local TCP port to expose (omit for interactive menu)")
    .option("-s, --server <url>", `Badger server WebSocket URL (default: ${DEFAULT_SERVER_URL})`)
    .option(
      "-w, --workspace <idOrName>",
      'Workspace id, name, or "personal" (defaults to persisted active workspace)',
    )
    .addHelpText(
      "after",
      `
Examples:
  $ badger 3000
  $ badger 3000 -s ws://localhost:8080
  $ badger 3000 -w personal
  $ badger

Related:
  badger login
  badger workspace
  badger status
`,
    )
    .action((portArg: string | undefined, options: StartCommandOptions) => {
      if (portArg === undefined || portArg.trim().length === 0) {
        void hooks.onNoPort();
        return;
      }
      void startCommand.execute(portArg, options);
    });
}

export type { CliWorkspaceMembership };
