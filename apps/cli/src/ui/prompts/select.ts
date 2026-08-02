import * as clack from "@clack/prompts";

import { selectFromMenu } from "../select-menu.js";
import { theme } from "../theme.js";

export interface PromptChoice<T> {
  readonly label: string;
  readonly value: T;
  readonly hint?: string;
}

/**
 * Returns true when the user cancelled a Clack prompt (Esc / Ctrl+C).
 */
export function isPromptCancel(value: unknown): value is symbol {
  return clack.isCancel(value);
}

/**
 * Interactive single-select menu (arrow keys + Enter). Esc cancels.
 *
 * Uses the Lumen-styled Badger menu on TTY (coral focus, ash idle) instead of
 * Clack’s hardcoded cyan theme.
 */
export async function promptSelect<T>(options: {
  readonly message: string;
  readonly choices: readonly PromptChoice<T>[];
  readonly initialValue?: T;
}): Promise<T | undefined> {
  if (options.choices.length === 0) {
    return undefined;
  }

  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return undefined;
  }

  let initialIndex = 0;
  if (options.initialValue !== undefined) {
    const found = options.choices.findIndex((c) => c.value === options.initialValue);
    if (found >= 0) {
      initialIndex = found;
    }
  }

  const result = await selectFromMenu(options.choices, {
    title: options.message,
    initialIndex,
  });

  if (result === undefined) {
    process.stderr.write(`${theme.muted("Cancelled.")}\n`);
  }

  return result;
}

/**
 * Yes/No confirmation. Esc cancels (returns undefined).
 */
export async function promptConfirm(options: {
  readonly message: string;
  readonly initialValue?: boolean;
}): Promise<boolean | undefined> {
  if (!process.stdin.isTTY || !process.stdout.isTTY) {
    return undefined;
  }

  const result = await selectFromMenu(
    [
      { label: "Yes", value: true as const },
      { label: "No", value: false as const },
    ],
    {
      title: options.message,
      initialIndex: options.initialValue === true ? 0 : 1,
    },
  );

  if (result === undefined) {
    process.stderr.write(`${theme.muted("Cancelled.")}\n`);
  }

  return result;
}
