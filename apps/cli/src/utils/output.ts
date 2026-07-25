/**
 * Destination for user-facing CLI output.
 */
export interface Writer {
  /**
   * Writes a single line to standard output.
   *
   * @param message - Text to print, without a trailing newline.
   */
  writeLine(message: string): void;

  /**
   * Writes a single line to standard error.
   *
   * @param message - Text to print, without a trailing newline.
   */
  writeError(message: string): void;
}

/**
 * {@link Writer} implementation backed by the process stdio streams.
 */
export class ConsoleWriter implements Writer {
  /**
   * Writes `message` to stdout.
   *
   * @param message - Text to print.
   */
  writeLine(message: string): void {
    console.log(message);
  }

  /**
   * Writes `message` to stderr.
   *
   * @param message - Text to print.
   */
  writeError(message: string): void {
    console.error(message);
  }
}
