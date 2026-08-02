import type { Command } from "commander";
import boxen from "boxen";

import { loadCliConfig } from "../config/cli.js";
import { DEFAULT_SERVER_URL, resolveServerUrl } from "../config/server.js";
import { AuthSessionManager } from "../services/auth-session-manager.js";
import { type CliAuthApiClient } from "../services/cli-auth-api-client.js";
import { CliConfigStore } from "../services/cli-config-store.js";
import { workspaceDisplayName } from "../services/workspace-labels.js";
import { WorkspacePreferenceStore } from "../services/workspace-preference-store.js";
import { createSpinner } from "../ui/spinner.js";
import { formatFriendlyError } from "../ui/formatters/errors.js";
import { lumen } from "../ui/lumen.js";
import { theme } from "../ui/theme.js";
import type { Writer } from "../utils/output.js";

export interface StatusCommandOptions {
  readonly server?: string;
}

export class StatusCommand {
  constructor(
    private readonly authApi: CliAuthApiClient,
    private readonly sessions: AuthSessionManager,
    private readonly preferences: WorkspacePreferenceStore,
    private readonly configStore: CliConfigStore,
    private readonly writer: Writer,
  ) {}

  async execute(options: StatusCommandOptions = {}): Promise<void> {
    const serverUrl = resolveServerUrl(options.server);
    const cli = loadCliConfig();
    const userConfig = this.configStore.load();
    const spinner = createSpinner(this.writer, process.stderr.isTTY);

    const session = this.sessions.load(serverUrl);
    let email = "(not logged in)";
    let workspace = "(none)";
    let loggedIn = false;

    if (session !== undefined) {
      spinner.start("Checking session...");
      try {
        const token = await this.sessions.getValidAccessToken(serverUrl);
        if (token !== undefined) {
          loggedIn = true;
          const me = await this.authApi.whoami(serverUrl, token);
          email = me.email ?? me.id;
          const preferred = this.preferences.load(serverUrl);
          workspace = preferred?.workspaceName ?? preferred?.workspaceId ?? "(none)";
          try {
            const memberships = await this.authApi.listWorkspaces(serverUrl, token);
            const match = memberships.find((row) => row.workspace.id === preferred?.workspaceId);
            if (match !== undefined) {
              workspace = workspaceDisplayName(match);
            }
          } catch {
            // keep stored name
          }
        }
      } catch (error: unknown) {
        spinner.stop();
        this.writer.writeError(theme.error(formatFriendlyError(error)));
      } finally {
        spinner.stop();
      }
    }

    const latencyMs = await measureLatency(serverUrl);

    const lines = [
      `${theme.label("Logged in")}    ${loggedIn ? theme.success("Yes") : theme.warning("No")}`,
      `${theme.label("User")}         ${email}`,
      `${theme.label("Workspace")}    ${workspace}`,
      `${theme.label("Tunnel")}       ${theme.muted("idle (no active tunnel in this process)")}`,
      `${theme.label("Server")}       ${serverUrl}`,
      `${theme.label("Dashboard")}    ${userConfig.dashboardUrl}`,
      `${theme.label("Version")}      ${cli.version}`,
      `${theme.label("Latency")}      ${
        latencyMs === undefined ? theme.muted("n/a") : theme.info(`${String(latencyMs)} ms`)
      }`,
    ].join("\n");

    this.writer.writeLine(
      boxen(lines, {
        padding: 1,
        borderStyle: "single",
        borderColor: lumen.slate,
        dimBorder: true,
        title: theme.heading("Badger status"),
        titleAlignment: "left",
      }),
    );
  }
}

async function measureLatency(serverWebsocketUrl: string): Promise<number | undefined> {
  try {
    const httpBase = serverWebsocketUrl
      .replace(/^wss:/i, "https:")
      .replace(/^ws:/i, "http:")
      .replace(/\/$/, "");
    const started = Date.now();
    const response = await fetch(`${httpBase}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(4000),
    });
    if (!response.ok) {
      return undefined;
    }
    return Date.now() - started;
  } catch {
    return undefined;
  }
}

export function registerStatusCommand(program: Command, command: StatusCommand): void {
  program
    .command("status")
    .description("Show login, workspace, server, and connectivity status")
    .option("-s, --server <url>", `Badger server WebSocket URL (default: ${DEFAULT_SERVER_URL})`)
    .action((options: StatusCommandOptions) => {
      void command.execute(options);
    });
}
