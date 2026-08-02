import ora, { type Ora } from "ora";

import type { Writer } from "../utils/output.js";

/**
 * Progress indicator for long-running CLI steps.
 *
 * Abstracted so non-interactive environments (CI, piped output) can fall back
 * to plain lines, and so tests can assert on transitions without ANSI noise.
 */
export interface Spinner {
  /**
   * Shows the spinner with an initial message.
   *
   * @param text - Status text to display.
   */
  start(text: string): void;

  /**
   * Replaces the current status text without ending the spinner.
   *
   * @param text - New status text.
   */
  update(text: string): void;

  /**
   * Stops the spinner with a success mark.
   *
   * @param text - Final status text.
   */
  succeed(text: string): void;

  /**
   * Stops the spinner with a failure mark.
   *
   * @param text - Final status text.
   */
  fail(text: string): void;

  /**
   * Stops the spinner with a warning mark.
   *
   * @param text - Final status text.
   */
  warn(text: string): void;

  /**
   * Clears the spinner without printing a final mark.
   */
  stop(): void;
}

/**
 * {@link Spinner} backed by `ora`, for interactive terminals.
 *
 * Renders to stderr so stdout stays clean for the tunnel URL.
 */
export class OraSpinner implements Spinner {
  private instance: Ora | undefined;

  /**
   * Shows the spinner with an initial message.
   *
   * @param text - Status text to display.
   */
  start(text: string): void {
    if (this.instance === undefined) {
      this.instance = ora({ text, stream: process.stderr, color: "red" });
    } else {
      this.instance.text = text;
    }

    this.instance.start();
  }

  /**
   * Replaces the current status text without ending the spinner.
   *
   * @param text - New status text.
   */
  update(text: string): void {
    if (this.instance === undefined) {
      this.start(text);
      return;
    }

    this.instance.text = text;
  }

  /**
   * Stops the spinner with a success mark.
   *
   * @param text - Final status text.
   */
  succeed(text: string): void {
    this.settle((instance) => instance.succeed(text), text);
  }

  /**
   * Stops the spinner with a failure mark.
   *
   * @param text - Final status text.
   */
  fail(text: string): void {
    this.settle((instance) => instance.fail(text), text);
  }

  /**
   * Stops the spinner with a warning mark.
   *
   * @param text - Final status text.
   */
  warn(text: string): void {
    this.settle((instance) => instance.warn(text), text);
  }

  /**
   * Clears the spinner without printing a final mark.
   */
  stop(): void {
    this.instance?.stop();
    this.instance = undefined;
  }

  private settle(finish: (instance: Ora) => void, text: string): void {
    if (this.instance === undefined) {
      // No active spinner (e.g. a status arrived after a stop); still surface
      // the outcome rather than dropping it.
      process.stderr.write(`${text}\n`);
      return;
    }

    finish(this.instance);
    this.instance = undefined;
  }
}

/**
 * {@link Spinner} that prints plain lines instead of animating.
 *
 * Used when stderr is not a TTY so logs stay readable in CI and pipes.
 */
export class PlainSpinner implements Spinner {
  /**
   * @param writer - Destination for status lines.
   */
  constructor(private readonly writer: Writer) {}

  /**
   * Prints the initial status line.
   *
   * @param text - Status text.
   */
  start(text: string): void {
    this.writer.writeError(text);
  }

  /**
   * Prints an updated status line.
   *
   * @param text - Status text.
   */
  update(text: string): void {
    this.writer.writeError(text);
  }

  /**
   * Prints a success status line.
   *
   * @param text - Status text.
   */
  succeed(text: string): void {
    this.writer.writeError(text);
  }

  /**
   * Prints a failure status line.
   *
   * @param text - Status text.
   */
  fail(text: string): void {
    this.writer.writeError(text);
  }

  /**
   * Prints a warning status line.
   *
   * @param text - Status text.
   */
  warn(text: string): void {
    this.writer.writeError(text);
  }

  /**
   * No-op; plain output has nothing to clear.
   */
  stop(): void {
    // Nothing to clear when output is line-based.
  }
}

/**
 * Chooses the spinner implementation that suits the current stderr stream.
 *
 * @param writer - Fallback destination for non-interactive output.
 * @param interactive - Whether stderr is an interactive terminal.
 * @returns An animated spinner for TTYs, otherwise a line-based one.
 */
export function createSpinner(writer: Writer, interactive: boolean): Spinner {
  return interactive ? new OraSpinner() : new PlainSpinner(writer);
}
