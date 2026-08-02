import boxen from "boxen";

import type { CliConfig } from "../config/cli.js";
import { animationsEnabled, playCoralPulse, playFrames, playShimmerLine } from "./animations.js";
import {
  BADGER_BLINK_FRAMES,
  BADGER_IDLE,
  colorizeDrawing,
} from "./drawings/mascot.js";
import { cli, lumen } from "./lumen.js";
import { theme } from "./theme.js";
import type { Writer } from "../utils/output.js";

/**
 * Prints a branded Badger welcome with a short mascot blink (TTY only).
 *
 * Kept under ~800ms so interactive menus still feel instant.
 */
export async function printWelcomeBanner(writer: Writer, config: CliConfig): Promise<void> {
  if (animationsEnabled(process.stderr)) {
    await playFrames(
      BADGER_BLINK_FRAMES.map((frame) => colorizeDrawing(frame)),
      { intervalMs: 110, loops: 2 },
    );
    writer.writeLine(colorizeDrawing(BADGER_IDLE));
    writer.writeLine("");
    await playShimmerLine("◆");
    await playCoralPulse({ beats: 1 });
  } else {
    writer.writeLine(colorizeDrawing(BADGER_IDLE));
    writer.writeLine("");
  }

  const body = [
    theme.brandLine("badger"),
    theme.heading("Badger CLI"),
    theme.muted("Developer Networking Platform"),
    theme.label(`Version ${config.version}`),
  ].join("\n");

  writer.writeLine(
    boxen(body, {
      padding: { top: 0, bottom: 0, left: 1, right: 1 },
      margin: { top: 0, bottom: 1, left: 0, right: 0 },
      borderStyle: "single",
      borderColor: lumen.slate,
      dimBorder: true,
    }),
  );
}

/**
 * Formats a coral-accented brand mark for banners.
 */
export function brandMark(): string {
  return cli.brand("◆");
}
