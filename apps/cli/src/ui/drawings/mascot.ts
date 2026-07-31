import { brandGradient } from "../formatters/boxes.js";
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
 * Tunnel “digging” frames — short progress strip, not large ASCII.
 */
export const TUNNEL_DIG_FRAMES: readonly string[] = [
  "  🦡·······[  ]",
  "  🦡·>·····[  ]",
  "  ·🦡··>···[  ]",
  "  ··🦡···>·[  ]",
  "  ···🦡····[=>]",
  "  ····🦡···[══]",
];

/**
 * Spark / celebrate frames after success.
 */
export const SPARKLE_FRAMES: readonly string[] = [
  "  ·  ✦  ·",
  " ✦  ·  ✦ ",
  "·  ✦✦  ·",
  "  ✦  ·  ✦",
];

/**
 * Wave goodbye frames.
 */
export const WAVE_FRAMES: readonly string[] = [
  "  🦡  👋",
  "  🦡 ✋ ",
  "  🦡  👋",
];

/**
 * Colors a multi-line drawing with the brand gradient on TTYs.
 */
export function colorizeDrawing(drawing: string): string {
  if (!process.stdout.isTTY || process.env["NO_COLOR"] !== undefined) {
    return theme.muted(drawing);
  }
  return drawing
    .split("\n")
    .map((line) => brandGradient(line))
    .join("\n");
}
