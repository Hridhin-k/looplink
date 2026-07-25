import { LOG_LEVEL_SEVERITY, LOG_LEVELS, SILENT_THRESHOLD } from "../constants/logging.js";
import type { LogLevel, LogThreshold } from "../types/logging.js";

/**
 * Type guard for {@link LogLevel}, for validating untrusted input such as CLI
 * flags or environment variables.
 *
 * @param value - Candidate value.
 * @returns `true` when `value` is a supported log level.
 */
export function isLogLevel(value: unknown): value is LogLevel {
  return typeof value === "string" && (LOG_LEVELS as readonly string[]).includes(value);
}

/**
 * Type guard for {@link LogThreshold}, accepting every log level plus `silent`.
 *
 * @param value - Candidate value.
 * @returns `true` when `value` is a supported threshold.
 */
export function isLogThreshold(value: unknown): value is LogThreshold {
  return isLogLevel(value) || value === SILENT_THRESHOLD;
}

/**
 * Decides whether a record of the given level passes a configured threshold.
 *
 * @param threshold - Minimum severity the consumer wants to emit.
 * @param level - Severity of the record being considered.
 * @returns `true` when the record should be emitted.
 */
export function shouldLog(threshold: LogThreshold, level: LogLevel): boolean {
  if (threshold === SILENT_THRESHOLD) {
    return false;
  }

  return LOG_LEVEL_SEVERITY[level] >= LOG_LEVEL_SEVERITY[threshold];
}
