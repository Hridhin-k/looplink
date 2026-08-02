import { cli } from "../lumen.js";
import { theme } from "../theme.js";

/**
 * Compact Badger mascot (static). Used when animation is disabled.
 */
export const BADGER_IDLE = [
  "      ___",
  "     /o o\\",
  "    (  >  )",
  "     \\_-_/",
  "    /|   |\\",
  "   (_|_|_|_)",
].join("\n");

/**
 * Two-frame blink for a tiny idle animation.
 */
export const BADGER_BLINK_FRAMES: readonly string[] = [
  [
    "      ___",
    "     /o o\\",
    "    (  >  )",
    "     \\_-_/",
    "    /|   |\\",
    "   (_|_|_|_)",
  ].join("\n"),
  [
    "      ___",
    "     /- -\\",
    "    (  >  )",
    "     \\_-_/",
    "    /|   |\\",
    "   (_|_|_|_)",
  ].join("\n"),
];

/**
 * Tunnel “digging” frames — coral mark, ash trail (no emoji / rainbow).
 */
export const TUNNEL_DIG_FRAMES: readonly string[] = [
  "  ◆·······[  ]",
  "  ◆·>·····[  ]",
  "  ·◆··>···[  ]",
  "  ··◆···>·[  ]",
  "  ···◆····[=>]",
  "  ····◆···[══]",
];

/**
 * Spark / celebrate frames after success — soft green pulse.
 */
export const SPARKLE_FRAMES: readonly string[] = [
  "  ·  ✦  ·",
  " ✦  ·  ✦ ",
  "·  ✦✦  ·",
  "  ✦  ·  ✦",
];

/**
 * Wave goodbye frames — coral brand mark.
 */
export const WAVE_FRAMES: readonly string[] = [
  "  ◆  ···",
  "  ◆ ··· ",
  "  ◆  ···",
];

/**
 * Colors a multi-line drawing with Lumen palette on TTYs.
 * Structure in ash; eyes / brand marks (`o`, `◆`, `>`) in coral.
 */
export function colorizeDrawing(drawing: string): string {
  if (!process.stdout.isTTY || process.env["NO_COLOR"] !== undefined) {
    return theme.muted(drawing);
  }
  return drawing
    .split("\n")
    .map((line) => colorizeMascotLine(line))
    .join("\n");
}

/**
 * Dig / tunnel progress strip — coral diamond, ash trail.
 */
export function colorizeDigFrame(frame: string): string {
  if (!process.stdout.isTTY || process.env["NO_COLOR"] !== undefined) {
    return frame;
  }
  return frame
    .split("")
    .map((ch) => {
      if (ch === "◆" || ch === ">" || ch === "=" || ch === "═") {
        return cli.brand(ch);
      }
      if (ch === "[" || ch === "]") {
        return cli.label(ch);
      }
      return cli.muted(ch);
    })
    .join("");
}

/**
 * Success sparkle — success green accents on ash field.
 */
export function colorizeSparkleFrame(frame: string): string {
  if (!process.stdout.isTTY || process.env["NO_COLOR"] !== undefined) {
    return frame;
  }
  return frame
    .split("")
    .map((ch) => (ch === "✦" ? cli.ok(ch) : cli.muted(ch)))
    .join("");
}

function colorizeMascotLine(line: string): string {
  return line
    .split("")
    .map((ch) => {
      if (ch === "o" || ch === ">" || ch === "◆") {
        return cli.brand(ch);
      }
      if (ch === "-" || ch === "_" || ch === "/" || ch === "\\" || ch === "|" || ch === "(" || ch === ")") {
        return cli.label(ch);
      }
      return cli.muted(ch);
    })
    .join("");
}
