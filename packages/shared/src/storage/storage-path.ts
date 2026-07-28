/**
 * Validates a storage namespace or key segment.
 *
 * @param label - Field name for error messages (`namespace` or `key`).
 * @param value - Candidate string.
 * @returns Trimmed non-empty value.
 */
export function assertStorageSegment(label: "namespace" | "key", value: string): string {
  if (typeof value !== "string") {
    throw new TypeError(`Storage ${label} must be a string.`);
  }

  const trimmed = value.trim();
  if (trimmed.length === 0) {
    throw new Error(`Storage ${label} must be a non-empty string.`);
  }

  return trimmed;
}
