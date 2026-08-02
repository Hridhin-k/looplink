import chalk from "chalk";

/**
 * Lumen ecosystem palette for Badger CLI.
 * Hex values must match styles/ECOSYSTEM_DESIGN.md §7 — do not fork casually.
 */
export const lumen = {
  coral: "#ff6363",
  ember: "#452324",
  white: "#ffffff",
  mist: "#e6e6e6",
  ash: "#9c9c9d",
  smoke: "#6a6b6c",
  slate: "#2f3031",
  ink: "#07080a",
  void: "#040506",
  ok: "#59d499",
  info: "#56c2ff",
} as const;

type Paint = (s: string) => string;

function hexOr(
  hex: string,
  fallback: Paint,
): Paint {
  return (s: string) => {
    try {
      return chalk.hex(hex)(s);
    } catch {
      return fallback(s);
    }
  };
}

/**
 * Truecolor CLI paints with ANSI 16 fallbacks (coral→red, ok→green, info→cyan, muted→dim).
 */
export const cli = {
  brand: hexOr(lumen.coral, chalk.red),
  ok: hexOr(lumen.ok, chalk.green),
  info: hexOr(lumen.info, chalk.cyan),
  muted: hexOr(lumen.smoke, chalk.dim),
  label: hexOr(lumen.ash, chalk.gray),
  text: hexOr(lumen.mist, chalk.white),
  strong: (s: string) => {
    try {
      return chalk.bold.hex(lumen.white)(s);
    } catch {
      return chalk.bold.white(s);
    }
  },
  err: hexOr(lumen.coral, chalk.red),
  border: hexOr(lumen.slate, chalk.dim),
} as const;

/** Coral brand mark used as a line prefix. */
export const BRAND_MARK = "◆";

/**
 * Prefixes a line with the coral Badger mark.
 */
export function brandPrefix(rest = "badger"): string {
  return `${cli.brand(BRAND_MARK)} ${cli.label(rest)}`;
}
