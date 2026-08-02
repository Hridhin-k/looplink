import chalk from "chalk";

/**
 * Lumen ecosystem palette for Badger CLI.
 *
 * Hex values MUST stay in sync with:
 * - `styles/design-tokens.json`
 * - `styles/ECOSYSTEM_DESIGN.md` §7
 * - `styles/ecosystem-tokens.css`
 *
 * Do not invent a second brand color.
 */
export const lumen = {
  /** void-black — canvas */
  void: "#040506",
  /** ink — elevated surface */
  ink: "#07080a",
  /** obsidian */
  obsidian: "#111214",
  /** graphite */
  graphite: "#1b1c1e",
  /** slate — borders / boxes */
  slate: "#2f3031",
  /** iron */
  iron: "#454647",
  /** smoke — muted / help */
  smoke: "#6a6b6c",
  /** ash — labels / headers */
  ash: "#9c9c9d",
  /** mist — primary text */
  mist: "#e6e6e6",
  /** pure-white — headings */
  white: "#ffffff",
  /** coral-pulse — brand / error / focus (scarce) */
  coral: "#ff6363",
  /** ember-hush — soft coral wash */
  ember: "#452324",
  /** Soft coral for warnings (derived, still coral family — not yellow) */
  coralSoft: "#ff8f8f",
  /** info-blue */
  info: "#56c2ff",
  /** success-green */
  ok: "#59d499",
  /** electric-sky (rare accent) */
  sky: "#63a1ff",
} as const;

type Paint = (s: string) => string;

function hexOr(hex: string, fallback: Paint): Paint {
  return (s: string) => {
    try {
      return chalk.hex(hex)(s);
    } catch {
      return fallback(s);
    }
  };
}

/**
 * Truecolor CLI paints with ANSI 16 fallbacks
 * (coral→red, ok→green, info→cyan, muted→dim).
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
  warn: hexOr(lumen.coralSoft, chalk.redBright),
  border: hexOr(lumen.slate, chalk.dim),
} as const;

/** Coral brand mark used as a line prefix (`◆`). */
export const BRAND_MARK = "◆";

/**
 * Prefixes a line with the coral Badger mark.
 */
export function brandPrefix(rest = "badger"): string {
  return `${cli.brand(BRAND_MARK)} ${cli.label(rest)}`;
}
