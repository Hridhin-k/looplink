import { theme } from "./theme.js";

export interface SelectMenuOption<T> {
  readonly label: string;
  readonly value: T;
  readonly hint?: string;
}

export interface SelectMenuOptions {
  readonly title: string;
  readonly initialIndex?: number;
  /** When false/non-TTY, falls back to printing a numbered list is not used — caller handles. */
  readonly stdin?: NodeJS.ReadStream;
  readonly stdout?: NodeJS.WriteStream;
}

/**
 * Interactive arrow-key menu for TTY terminals — Lumen palette.
 *
 * Selected row: coral ◆ + mist label. Idle: ash. Hints: smoke.
 * Returns `undefined` when cancelled (Ctrl+C / Escape) or when stdin is not a TTY.
 */
export async function selectFromMenu<T>(
  choices: readonly SelectMenuOption<T>[],
  options: SelectMenuOptions,
): Promise<T | undefined> {
  if (choices.length === 0) {
    return undefined;
  }

  const stdin = options.stdin ?? process.stdin;
  const stdout = options.stdout ?? process.stdout;

  if (!stdin.isTTY || !stdout.isTTY || typeof stdin.setRawMode !== "function") {
    return undefined;
  }

  let index = Math.min(
    Math.max(options.initialIndex ?? 0, 0),
    choices.length - 1,
  );

  return new Promise<T | undefined>((resolve) => {
    const render = (): void => {
      stdout.write("\x1b[?25l"); // hide cursor
      stdout.write(`${theme.brandLine()}\n`);
      stdout.write(`${theme.heading(options.title)}\n`);
      for (let i = 0; i < choices.length; i += 1) {
        const choice = choices[i];
        if (choice === undefined) {
          continue;
        }
        const selected = i === index;
        const marker = selected ? theme.highlight("◆") : theme.muted("·");
        const label = selected ? theme.text(choice.label) : theme.label(choice.label);
        const hint =
          choice.hint !== undefined && choice.hint.length > 0
            ? theme.muted(`  ${choice.hint}`)
            : "";
        stdout.write(`  ${marker} ${label}${hint}\n`);
      }
      stdout.write(theme.muted("  ↑/↓ navigate · enter confirm · esc cancel\n"));
    };

    const clear = (): void => {
      const lines = choices.length + 3; // brand + title + footer
      stdout.write(`\x1b[${String(lines)}A`);
      stdout.write("\x1b[0J");
    };

    const cleanup = (result: T | undefined): void => {
      stdin.off("data", onData);
      stdin.setRawMode(false);
      stdin.pause();
      stdout.write("\x1b[?25h"); // show cursor
      resolve(result);
    };

    const onData = (chunk: Buffer): void => {
      const key = chunk.toString("utf8");

      if (key === "\u0003" || key === "\u001b") {
        clear();
        cleanup(undefined);
        return;
      }

      if (key === "\r" || key === "\n") {
        const selected = choices[index];
        clear();
        cleanup(selected?.value);
        return;
      }

      if (key === "\u001b[A" || key === "k") {
        index = index === 0 ? choices.length - 1 : index - 1;
        clear();
        render();
        return;
      }

      if (key === "\u001b[B" || key === "j") {
        index = index === choices.length - 1 ? 0 : index + 1;
        clear();
        render();
      }
    };

    stdin.setRawMode(true);
    stdin.resume();
    stdin.on("data", onData);
    render();
  });
}
