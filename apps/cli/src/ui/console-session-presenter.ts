import { APP_DISPLAY_NAME } from "@hridhin-k/badger-shared";

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
 * Feature switches resolved from the environment.
 */
export interface PresenterOptions {
  /** Draw a QR code beneath the URL. Disabled for non-interactive output. */
  readonly showQrCode: boolean;
  /** Copy the public URL to the clipboard when a tunnel becomes ready. */
  readonly copyUrl: boolean;
}

/** Width of the banner's label column, in characters. */
const LABEL_WIDTH = 12;

/**
 * Describes an error for display.
 *
 * Socket-level failures such as `AggregateError` from a refused connection
 * carry an empty message, which would otherwise render as "Reconnect failed: ".
 *
 * @param error - Failure to describe.
 * @returns A non-empty human-readable reason.
 */
function describe(error: Error): string {
  const message = error.message.trim();
  return message.length > 0 ? message : "server unreachable";
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
   * Reports that a session is starting for a local port.
   *
   * @param port - Local TCP port being exposed.
   */
  starting(port: number): void {
    this.spinner.start(
      `Starting ${theme.heading(APP_DISPLAY_NAME)} on port ${theme.url(String(port))}...`,
    );
  }

  /**
   * Reports a completed handshake with the server.
   */
  connected(): void {
    this.spinner.update(
      `Connected to ${APP_DISPLAY_NAME} server. ${theme.muted("Requesting tunnel...")}`,
    );
  }

  /**
   * Renders the banner for a newly created tunnel.
   *
   * @param tunnel - Tunnel details to display.
   */
  async tunnelReady(tunnel: TunnelPresentation): Promise<void> {
    this.spinner.succeed(theme.success(`Connected to ${APP_DISPLAY_NAME} server.`));
    await this.renderBanner("Tunnel Created", tunnel);
  }

  /**
   * Reports that the live connection dropped and a retry is pending.
   *
   * Announced once per outage; each failed attempt then updates the same
   * status rather than repeating the banner.
   */
  connectionLost(): void {
    if (this.reconnecting) {
      return;
    }

    this.reconnecting = true;
    this.spinner.start(theme.warning(`Connection lost. Reconnecting to ${APP_DISPLAY_NAME}...`));
  }

  /**
   * Reports a failed reconnect attempt before the next retry.
   *
   * @param error - Reason the attempt failed.
   */
  reconnectFailed(error: Error): void {
    this.spinner.update(theme.warning(`Reconnect failed: ${describe(error)}. Retrying...`));
  }

  /**
   * Renders the banner after a successful reconnect.
   *
   * @param tunnel - Tunnel details active on the new connection.
   */
  async reconnected(tunnel: TunnelPresentation): Promise<void> {
    this.reconnecting = false;

    const headline = tunnel.restored ? "Reconnected. Tunnel restored." : "Reconnected.";
    this.spinner.succeed(theme.success(headline));

    await this.renderBanner(tunnel.restored ? "Tunnel Restored" : "Tunnel Created", tunnel);
  }

  /**
   * Reports that the session could not be established.
   *
   * @param message - Human-readable failure description.
   */
  failed(message: string): void {
    this.reconnecting = false;
    this.spinner.fail(theme.error(`Failed to create tunnel: ${message}`));
  }

  /**
   * Reports that a shutdown signal was received.
   */
  shuttingDown(): void {
    this.spinner.stop();
    this.writer.writeLine("");
    this.writer.writeLine(theme.muted(`Stopping ${APP_DISPLAY_NAME}...`));
  }

  /**
   * Reports that the session closed cleanly.
   */
  stopped(): void {
    this.writer.writeLine(theme.success("Tunnel closed. Goodbye."));
  }

  /**
   * Prints the tunnel summary, optional QR code, and the stop hint.
   *
   * The QR code is only redrawn when the URL actually changes, so a reconnect
   * that restores the same tunnel does not spam the terminal.
   *
   * @param headline - Banner title.
   * @param tunnel - Tunnel details to display.
   */
  private async renderBanner(headline: string, tunnel: TunnelPresentation): Promise<void> {
    const urlChanged = this.lastRenderedUrl !== tunnel.publicUrl;
    const copied = this.options.copyUrl
      ? await this.dependencies.copyToClipboard(tunnel.publicUrl)
      : false;

    this.writer.writeLine("");
    this.writer.writeLine(theme.heading(headline));
    this.writer.writeLine("");
    this.writeRow(
      "Forwarding",
      `${theme.url(tunnel.publicUrl)} ${theme.muted("→")} ${theme.muted(`http://localhost:${String(tunnel.port)}`)}`,
    );

    if (this.options.copyUrl) {
      this.writeRow(
        "Clipboard",
        copied ? theme.success("URL copied") : theme.muted("unavailable on this system"),
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

  private writeRow(label: string, value: string): void {
    this.writer.writeLine(`  ${theme.label(label.padEnd(LABEL_WIDTH))}${value}`);
  }
}
