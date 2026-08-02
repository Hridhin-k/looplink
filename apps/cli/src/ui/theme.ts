import { brandPrefix, cli, lumen } from "./lumen.js";

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
  /** Primary body / table values (mist). */
  text(text: string): string;
  /** Interactive highlight (selected menu rows / active tunnel). */
  highlight(text: string): string;
  /** Confirmation of a completed step. */
  success(text: string): string;
  /** Recoverable problems — soft coral, never yellow rainbow. */
  warning(text: string): string;
  /** Failures that end or degrade the session. */
  error(text: string): string;
  /** Secondary text such as hints and local addresses. */
  muted(text: string): string;
  /** Informational body text. */
  info(text: string): string;
  /** Coral brand line prefix, e.g. `◆ badger`. */
  brandLine(suffix?: string): string;
}

/**
 * Lumen-mapped Badger CLI palette — coral brand, green ok, cyan info, ash labels.
 * Source: `styles/ECOSYSTEM_DESIGN.md` §7.
 */
export const theme: Theme = {
  heading: (text) => cli.strong(text),
  label: (text) => cli.label(text),
  url: (text) => cli.text(text),
  text: (text) => cli.text(text),
  highlight: (text) => cli.brand(text),
  success: (text) => cli.ok(text),
  warning: (text) => cli.warn(text),
  error: (text) => cli.err(text),
  muted: (text) => cli.muted(text),
  info: (text) => cli.info(text),
  brandLine: (suffix = "badger") => brandPrefix(suffix),
};

export { lumen, cli, brandPrefix, BRAND_MARK } from "./lumen.js";
