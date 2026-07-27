import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Merges Tailwind class names, resolving conflicts via `tailwind-merge`.
 *
 * Required by shadcn/ui component primitives. No UI components are shipped yet.
 *
 * @param inputs - Class name values accepted by `clsx`.
 * @returns A single class string safe for Tailwind utility composition.
 */
export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}
