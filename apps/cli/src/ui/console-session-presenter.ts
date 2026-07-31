import { APP_DISPLAY_NAME } from "@hridhin-k/badger-shared";

import { animationsEnabled, playFrames } from "./animations.js";
import {
  SPARKLE_FRAMES,
  TUNNEL_DIG_FRAMES,
  WAVE_FRAMES,
  colorizeDrawing,
} from "./drawings/mascot.js";
import { formatTunnelBox, formatTunnelLiveArt, formatSuccessLine } from "./formatters/boxes.js";
import { formatFriendlyError } from "./formatters/errors.js";
import type { SessionPresenter, TunnelPresentation } from "./session-presenter.js";
import type { Spinner } from "./spinner.js";
import { theme } from "./theme.js";
import type { ClipboardWriter } from "../utils/clipboard.js";
import type { Writer } from "../utils/output.js";
import type { QrCodeRenderer } from "../utils/qrcode.js";

/**
 * Collaborators the presenter needs for optional terminal features.
 */
export interface PresenterDependencies {
  /** Copies the public URL to the system clipboard. */
  readonly copyToClipboard: ClipboardWriter;
  /** Renders the public URL as a scannable QR code. */
  readonly renderQrCode: QrCodeRenderer;
}

/**
 * Feature switches resolved from the environment / config.
 */
export interface PresenterOptions {
  /** Draw a QR code beneath the URL. Disabled for non-interactive output. */
  readonly showQrCode: boolean;
  /** Copy the public URL to the clipboard when a tunnel becomes ready. */
  readonly copyUrl: boolean;
}

/**
 * Renders a Badger session to the terminal.
 *
 * Status transitions animate through a {@link Spinner} on stderr, while results
 * (URL, QR code) are written to stdout so they stay pipeable.
 */
export class ConsoleSessionPresenter implements SessionPresenter {
  private lastRenderedUrl: string | undefined;
  private reconnecting = false;
  private context: {
    workspaceLabel?: string;
    mode?: "workspace" | "anonymous";
  } = {};

  /**
   * @param writer - Destination for banner output.
   * @param spinner - Progress indicator for lifecycle transitions.
   * @param options - Feature switches for QR code and clipboard support.
   * @param dependencies - Clipboard and QR code collaborators.
   */
  constructor(
    private readonly writer: Writer,
    private readonly spinner: Spinner,
    private readonly options: PresenterOptions,
    private readonly dependencies: PresenterDependencies,
  ) {}

  /**
   * Sets workspace / mode labels shown in the tunnel box (presentation only).
   */
  setSessionContext(context: {
    readonly workspaceLabel?: string;
    readonly mode?: "workspace" | "anonymous";
  }): void {
    this.context = { ...context };
  }

  starting(port: number): void {
    this.spinner.start(`Creating tunnel on port ${theme.url(String(port))}...`);
  }

  connected(): void {
    this.spinner.update(`Connecting to ${APP_DISPLAY_NAME} server...`);
  }

  async tunnelReady(tunnel: TunnelPresentation): Promise<void> {
    this.spinner.succeed(theme.success(`Connected to ${APP_DISPLAY_NAME} server.`));
    if (animationsEnabled()) {
      await playFrames(
        TUNNEL_DIG_FRAMES.map((frame) => theme.highlight(frame)),
        { intervalMs: 70, loops: 1 },
      );
      await playFrames(
        SPARKLE_FRAMES.map((frame) => theme.success(frame)),
        { intervalMs: 60, loops: 1 },
      );
    }
    await this.renderBanner(tunnel);
  }

  connectionLost(): void {
    if (this.reconnecting) {
      return;
    }

    this.reconnecting = true;
    this.spinner.start(theme.warning(`Connection lost. Reconnecting...`));
  }

  reconnectFailed(error: Error): void {
    this.spinner.update(
      theme.warning(
        `${formatFriendlyError(error).split("\n")[0] ?? "Reconnect failed"}. Retrying...`,
      ),
    );
  }

  async reconnected(tunnel: TunnelPresentation): Promise<void> {
    this.reconnecting = false;

    const headline = tunnel.restored ? "Reconnected. Tunnel restored." : "Reconnected.";
    this.spinner.succeed(theme.success(headline));

    await this.renderBanner(tunnel);
  }

  failed(message: string): void {
    this.reconnecting = false;
    this.spinner.fail(theme.error(formatFriendlyError(message)));
  }

  shuttingDown(): void {
    this.spinner.stop();
    this.writer.writeLine("");
    this.writer.writeLine(theme.muted(`Stopping ${APP_DISPLAY_NAME}...`));
  }

  stopped(): void {
    if (animationsEnabled()) {
      void playFrames(
        WAVE_FRAMES.map((frame) => colorizeDrawing(frame)),
        { intervalMs: 140, loops: 2 },
      ).finally(() => {
        this.writer.writeLine(formatSuccessLine("Tunnel closed. Goodbye."));
      });
      return;
    }
    this.writer.writeLine(formatSuccessLine("Tunnel closed. Goodbye."));
  }

  private async renderBanner(tunnel: TunnelPresentation): Promise<void> {
    const urlChanged = this.lastRenderedUrl !== tunnel.publicUrl;
    const copied = this.options.copyUrl
      ? await this.dependencies.copyToClipboard(tunnel.publicUrl)
      : false;

    const workspaceLabel =
      tunnel.workspaceLabel ?? this.context.workspaceLabel ?? APP_DISPLAY_NAME;
    const mode = tunnel.mode ?? this.context.mode ?? "workspace";

    this.writer.writeLine("");
    if (animationsEnabled(process.stdout)) {
      this.writer.writeLine(formatTunnelLiveArt());
      this.writer.writeLine("");
    }
    this.writer.writeLine(
      formatTunnelBox({
        workspaceLabel,
        localUrl: `http://localhost:${String(tunnel.port)}`,
        publicUrl: tunnel.publicUrl,
        mode,
      }),
    );

    if (this.options.copyUrl) {
      this.writer.writeLine(
        copied
          ? formatSuccessLine("Public URL copied to clipboard")
          : theme.muted("Clipboard unavailable on this system"),
      );
    }

    if (this.options.showQrCode && urlChanged) {
      const qr = await this.dependencies.renderQrCode(tunnel.publicUrl);
      this.writer.writeLine("");
      this.writer.writeLine(qr);
    }

    this.writer.writeLine("");
    this.writer.writeLine(theme.muted("Press Ctrl+C to stop"));
    this.writer.writeLine("");

    this.lastRenderedUrl = tunnel.publicUrl;
  }
}
