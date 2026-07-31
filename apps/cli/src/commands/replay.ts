import { Buffer } from "node:buffer";

import type { Command } from "commander";

import { DEFAULT_SERVER_URL, resolveServerUrl } from "../config/server.js";
import { AuthSessionManager } from "../services/auth-session-manager.js";
import { ReplayApiClient, ReplayClientError } from "../services/replay-api-client.js";
import { WorkspacePreferenceStore } from "../services/workspace-preference-store.js";
import { theme } from "../ui/theme.js";
import type { Writer } from "../utils/output.js";

/**
 * Options accepted by the replay command after Commander parsing.
 */
export interface ReplayCommandOptions {
  /** Optional WebSocket URL override from `--server`. */
  readonly server?: string;
  /** Optional workspace override (defaults to persisted active workspace). */
  readonly workspace?: string;
}

/**
 * Commander adapter for `badger replay <requestId>`.
 *
 * Requires login — replay is Membership-scoped and never anonymous.
 */
export class ReplayCommand {
  constructor(
    private readonly client: ReplayApiClient,
    private readonly writer: Writer,
    private readonly sessions: AuthSessionManager,
    private readonly preferences: WorkspacePreferenceStore = new WorkspacePreferenceStore(),
  ) {}

  /**
   * Handles a single `badger replay <requestId>` invocation.
   */
  async execute(requestId: string, options: ReplayCommandOptions = {}): Promise<void> {
    const trimmed = requestId.trim();
    if (trimmed.length === 0) {
      this.writer.writeError(theme.error("requestId must not be empty."));
      process.exitCode = 1;
      return;
    }

    const serverUrl = resolveServerUrl(options.server);

    try {
      const accessToken = await this.sessions.getValidAccessToken(serverUrl);
      if (accessToken === undefined) {
        throw new Error(
          `Not logged in. Run \`badger login -s ${serverUrl}\` before replaying traffic.`,
        );
      }

      const workspaceId =
        options.workspace !== undefined && options.workspace.trim().length > 0
          ? options.workspace.trim()
          : this.preferences.load(serverUrl)?.workspaceId;

      const result = await this.client.replay(serverUrl, trimmed, {
        accessToken,
        ...(workspaceId === undefined ? {} : { workspaceId }),
      });
      const bodyText = Buffer.from(result.bodyBase64, "base64").toString("utf8");

      this.writer.writeLine(`${result.method} ${result.path} → ${String(result.statusCode)}`);
      this.writer.writeLine(`tunnel: ${result.tunnelId}`);
      if (result.requestBodyTruncated) {
        this.writer.writeLine(theme.warning("warning: recorded request body was truncated"));
      }
      this.writer.writeLine(bodyText);
    } catch (error: unknown) {
      if (error instanceof ReplayClientError) {
        this.writer.writeError(theme.error(`${error.code}: ${error.message}`));
      } else if (error instanceof Error) {
        this.writer.writeError(theme.error(error.message));
      } else {
        this.writer.writeError(theme.error(String(error)));
      }
      process.exitCode = 1;
    }
  }
}

/**
 * Registers `badger replay <requestId>` on a Commander program.
 */
export function registerReplayCommand(program: Command, replayCommand: ReplayCommand): void {
  program
    .command("replay")
    .description("Replay a previously recorded HTTP request through the live tunnel")
    .argument("<requestId>", "Traffic request id to replay")
    .option("-s, --server <url>", `Badger server WebSocket URL (default: ${DEFAULT_SERVER_URL})`)
    .option("-w, --workspace <id>", "Workspace id (defaults to active workspace preference)")
    .action((requestId: string, options: ReplayCommandOptions) => {
      void replayCommand.execute(requestId, options);
    });
}
