import type { LogLevel, LogThreshold } from "../types/logging.js";

/**
 * Threshold value that suppresses every log record.
 */
export const SILENT_THRESHOLD = "silent";

/**
 * Every supported log level, ordered from least to most severe.
 *
 * `satisfies` keeps the literal tuple type while still verifying the contents
 * against {@link LogLevel}, so adding a level to the type without adding it
 * here is a compile error.
 */
export const LOG_LEVELS = ["debug", "info", "warn", "error"] as const satisfies readonly LogLevel[];

/**
 * Numeric severity of each log level, for comparing a record against a
 * configured threshold. Higher numbers are more severe.
 */
export const LOG_LEVEL_SEVERITY: Readonly<Record<LogLevel, number>> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

/**
 * Threshold applied when a consumer has not configured one.
 */
export const DEFAULT_LOG_THRESHOLD: LogThreshold = "info";
