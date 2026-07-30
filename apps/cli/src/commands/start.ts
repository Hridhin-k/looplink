import type { Command } from "commander";

import { DEFAULT_SERVER_URL, resolveServerUrl } from "../config/server.js";
import { AuthSessionManager } from "../services/auth-session-manager.js";
import {
  CliAuthApiClient,
  type CliWorkspaceMembership,
} from "../services/cli-auth-api-client.js";
import type { StartTunnelService } from "../services/start-tunnel.js";
import { WorkspacePreferenceStore } from "../services/workspace-preference-store.js";
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

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu;

/**
 * Commander adapter for `badger <port>`.
 *
 * Validates the port argument and delegates to {@link StartTunnelService}.
 */
export class StartCommand {
  constructor(
    private readonly startTunnel: StartTunnelService,
    private readonly writer: Writer,
    private readonly sessions: AuthSessionManager,
    private readonly authApi: CliAuthApiClient,
    private readonly workspacePreferences: WorkspacePreferenceStore = new WorkspacePreferenceStore(),
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
      const workspaceId = await this.resolveWorkspaceId(serverUrl, options.workspace);
      await this.startTunnel.start(parsed.value, serverUrl, {
        getAuthToken: () => this.sessions.getValidAccessToken(serverUrl),
        ...(workspaceId === undefined
          ? {}
          : {
              getWorkspaceId: async () => workspaceId,
            }),
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.writer.writeError(theme.error(message));
      process.exitCode = 1;
    }
  }

  private async resolveWorkspaceId(
    serverUrl: string,
    workspaceRef: string | undefined,
  ): Promise<string | undefined> {
    const preferred =
      workspaceRef !== undefined && workspaceRef.trim().length > 0
        ? workspaceRef.trim()
        : this.workspacePreferences.load(serverUrl)?.workspaceId;

    if (preferred === undefined || preferred.length === 0) {
      return undefined;
    }

    const token = await this.sessions.getValidAccessToken(serverUrl);
    if (token === undefined) {
      const stored = this.sessions.load(serverUrl);
      const hint =
        stored === undefined
          ? `No session for ${serverUrl}. Run \`badger login -s ${serverUrl}\` first. ` +
            `(Badger server is usually ws://localhost:8080 — the port argument is your local app.)`
          : `Session for ${serverUrl} could not be refreshed. Run \`badger login -s ${serverUrl}\` again.`;
      throw new Error(hint);
    }

    try {
      const normalized = preferred;
      if (UUID_PATTERN.test(normalized)) {
        return normalized;
      }

      const memberships = await this.authApi.listWorkspaces(serverUrl, token);
      const match = findWorkspace(memberships, normalized);
      if (match === undefined) {
        const names = memberships.map((m) => m.workspace.name).join(", ");
        throw new Error(
          `Workspace "${normalized}" not found for this account.` +
            (names.length > 0 ? ` Available: ${names}` : ""),
        );
      }

      this.writer.writeLine(
        theme.muted(`Using workspace “${match.workspace.name}” (${match.workspace.id})`),
      );
      return match.workspace.id;
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      if (/auth session missing|invalid.*token|unauthorized|jwt/i.test(message)) {
        throw new Error(
          `Auth session is invalid or expired (${message}). Run \`badger login -s ${serverUrl}\` and try again.`,
        );
      }
      throw error instanceof Error ? error : new Error(message);
    }
  }
}

function findWorkspace(
  memberships: readonly CliWorkspaceMembership[],
  name: string,
): CliWorkspaceMembership | undefined {
  const lowered = name.toLowerCase();
  const exact = memberships.filter((m) => m.workspace.name.toLowerCase() === lowered);
  if (exact.length === 1) {
    return exact[0];
  }
  if (exact.length > 1) {
    throw new Error(
      `Multiple workspaces named "${name}". Pass the workspace id instead.`,
    );
  }
  return undefined;
}

/**
 * Registers the default `badger <port>` action on a Commander program.
 */
export function registerStartCommand(program: Command, startCommand: StartCommand): void {
  program
    .argument("<port>", "Local TCP port to expose")
    .option("-s, --server <url>", `Badger server WebSocket URL (default: ${DEFAULT_SERVER_URL})`)
    .option(
      "-w, --workspace <idOrName>",
      "Workspace id or exact name (defaults to personal workspace when logged in)",
    )
    .action((portArg: string, options: StartCommandOptions) => {
      void startCommand.execute(portArg, options);
    });
}
