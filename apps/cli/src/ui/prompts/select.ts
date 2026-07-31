import * as clack from "@clack/prompts";

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

  const result = await clack.select({
    message: options.message,
    options: options.choices.map((choice) => ({
      label: choice.label,
      value: choice.value,
      hint: choice.hint,
    })) as Parameters<typeof clack.select<T>>[0]["options"],
    ...(options.initialValue !== undefined ? { initialValue: options.initialValue } : {}),
  });

  if (clack.isCancel(result)) {
    clack.cancel(theme.muted("Cancelled."));
    return undefined;
  }

  return result as T;
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

  const result = await clack.confirm({
    message: options.message,
    initialValue: options.initialValue ?? false,
  });

  if (clack.isCancel(result)) {
    clack.cancel(theme.muted("Cancelled."));
    return undefined;
  }

  return result;
}
