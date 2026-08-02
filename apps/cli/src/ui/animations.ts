/**
 * Lightweight terminal animations — Lumen rhythm (coral pulse, ash field).
 * Skipped on non-TTY / NO_COLOR / CI / BADGER_CLI_ANIMATIONS=0.
 */

import { cli } from "./lumen.js";

let userAnimationsPref: boolean | undefined;

/**
 * Applies the `badger config` animations toggle (call once at startup / after save).
 */
export function setAnimationsPreference(enabled: boolean): void {
  userAnimationsPref = enabled;
}

export function animationsEnabled(stream: NodeJS.WriteStream = process.stderr): boolean {
  if (userAnimationsPref === false) {
    return false;
  }
  if (process.env["NO_COLOR"] !== undefined) {
    return false;
  }
  if (process.env["CI"] === "1" || process.env["CI"] === "true") {
    return false;
  }
  if (process.env["BADGER_CLI_ANIMATIONS"] === "0") {
    return false;
  }
  return Boolean(stream.isTTY);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

/**
 * Plays frames in-place on stderr (does not pollute stdout piping).
 */
export async function playFrames(
  frames: readonly string[],
  options: {
    readonly intervalMs?: number;
    readonly loops?: number;
    readonly stream?: NodeJS.WriteStream;
  } = {},
): Promise<void> {
  const stream = options.stream ?? process.stderr;
  if (!animationsEnabled(stream) || frames.length === 0) {
    return;
  }

  // ~150ms machine feel from ecosystem motion, slightly faster for CLI feedback.
  const intervalMs = options.intervalMs ?? 70;
  const loops = options.loops ?? 1;
  const lineCount = Math.max(...frames.map((frame) => frame.split("\n").length));

  stream.write("\x1b[?25l"); // hide cursor
  try {
    for (let loop = 0; loop < loops; loop += 1) {
      for (const frame of frames) {
        const padded = padFrame(frame, lineCount);
        stream.write(padded);
        stream.write("\n");
        await sleep(intervalMs);
        stream.write(`\x1b[${String(lineCount)}A`);
        stream.write("\x1b[0J");
      }
    }
  } finally {
    stream.write("\x1b[?25h"); // show cursor
  }
}

/**
 * Types text to a writer with a short delay between chunks.
 */
export async function typewrite(
  write: (chunk: string) => void,
  text: string,
  options: { readonly charDelayMs?: number; readonly enabled?: boolean } = {},
): Promise<void> {
  const enabled = options.enabled ?? animationsEnabled(process.stdout);
  if (!enabled) {
    write(text);
    return;
  }

  const delay = options.charDelayMs ?? 8;
  for (const char of text) {
    write(char);
    if (char !== " " && char !== "\n") {
      await sleep(delay);
    }
  }
}

/**
 * Coral pulse traveling across an ash hairline — welcome / brand beat.
 */
export async function playShimmerLine(
  label: string,
  options: { readonly stream?: NodeJS.WriteStream; readonly width?: number } = {},
): Promise<void> {
  const stream = options.stream ?? process.stderr;
  if (!animationsEnabled(stream)) {
    return;
  }

  const width = Math.min(options.width ?? 32, 48);
  const frames: string[] = [];
  for (let i = 0; i < width; i += 1) {
    const chars: string[] = [];
    for (let j = 0; j < width; j += 1) {
      const dist = Math.abs(j - i);
      if (dist === 0) {
        chars.push(cli.brand("━"));
      } else if (dist === 1) {
        chars.push(cli.warn("─"));
      } else {
        chars.push(cli.muted("─"));
      }
    }
    frames.push(`  ${cli.brand(label)} ${chars.join("")}`);
  }

  await playFrames(frames, { intervalMs: 22, loops: 1, stream });
}

/**
 * Soft coral ◆ breathing pulse (connect / idle brand moment).
 */
export async function playCoralPulse(
  options: { readonly stream?: NodeJS.WriteStream; readonly beats?: number } = {},
): Promise<void> {
  const stream = options.stream ?? process.stderr;
  if (!animationsEnabled(stream)) {
    return;
  }

  const beats = options.beats ?? 3;
  const frames = [
    `  ${cli.muted("·")} ${cli.brand("◆")} ${cli.muted("·")}`,
    `  ${cli.warn("·")} ${cli.brand("◆")} ${cli.warn("·")}`,
    `  ${cli.brand("·")} ${cli.strong("◆")} ${cli.brand("·")}`,
    `  ${cli.warn("·")} ${cli.brand("◆")} ${cli.warn("·")}`,
  ];

  await playFrames(frames, { intervalMs: 90, loops: beats, stream });
}

function padFrame(frame: string, lineCount: number): string {
  const lines = frame.split("\n");
  while (lines.length < lineCount) {
    lines.push("");
  }
  return lines.join("\n");
}
