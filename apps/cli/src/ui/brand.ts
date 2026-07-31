import boxen from "boxen";

import type { CliConfig } from "../config/cli.js";
import { animationsEnabled, playFrames, playShimmerLine } from "./animations.js";
import {
  BADGER_BLINK_FRAMES,
  BADGER_IDLE,
  colorizeDrawing,
} from "./drawings/mascot.js";
import { brandGradient } from "./formatters/boxes.js";
import { theme } from "./theme.js";
import type { Writer } from "../utils/output.js";

/**
 * Prints a branded Badger welcome with a short mascot blink (TTY only).
 *
 * Kept under ~600ms so interactive menus still feel instant.
 */
export async function printWelcomeBanner(writer: Writer, config: CliConfig): Promise<void> {
  if (animationsEnabled(process.stderr)) {
    await playFrames(
      BADGER_BLINK_FRAMES.map((frame) => colorizeDrawing(frame)),
      { intervalMs: 120, loops: 2 },
    );
    // Leave the idle face on screen
    writer.writeLine(colorizeDrawing(BADGER_IDLE));
    writer.writeLine("");
    await playShimmerLine("link");
  } else {
    writer.writeLine(theme.muted(BADGER_IDLE));
    writer.writeLine("");
  }

  const title = brandGradient("Badger CLI");
  const body = [
    theme.heading(`🦡  ${title}`),
    theme.info("Developer Networking Platform"),
    theme.muted(`Version ${config.version}`),
  ].join("\n");

  writer.writeLine(
    boxen(body, {
      padding: { top: 0, bottom: 0, left: 1, right: 1 },
      margin: { top: 0, bottom: 1, left: 0, right: 0 },
      borderStyle: "single",
      borderColor: "cyan",
      dimBorder: true,
    }),
  );
}
