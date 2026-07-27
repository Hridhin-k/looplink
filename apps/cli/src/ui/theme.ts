import chalk from "chalk";

/**
 * Semantic colors for CLI output.
 *
 * Callers use intent (`success`, `error`) rather than raw colors so the palette
 * can change in one place. Chalk disables styling automatically when the
 * stream is not a TTY or `NO_COLOR` is set.
 */
export interface Theme {
  /** Product name and section headings. */
  heading(text: string): string;
  /** Left-hand column labels in the session banner. */
  label(text: string): string;
  /** Public tunnel URLs and other primary values. */
  url(text: string): string;
  /** Confirmation of a completed step. */
  success(text: string): string;
  /** Recoverable problems such as a dropped connection. */
  warning(text: string): string;
  /** Failures that end or degrade the session. */
  error(text: string): string;
  /** Secondary text such as hints and local addresses. */
  muted(text: string): string;
}

/**
 * Default Badger color palette.
 */
export const theme: Theme = {
  heading: (text) => chalk.bold.cyan(text),
  label: (text) => chalk.dim.bold(text),
  url: (text) => chalk.bold.green(text),
  success: (text) => chalk.green(text),
  warning: (text) => chalk.yellow(text),
  error: (text) => chalk.red(text),
  muted: (text) => chalk.dim(text),
};
