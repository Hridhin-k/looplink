/**
 * Severity level attached to an individual log record.
 *
 * Ordered from least to most severe: `debug` < `info` < `warn` < `error`.
 */
export type LogLevel = "debug" | "info" | "warn" | "error";

/**
 * Minimum severity a consumer is willing to emit.
 *
 * Distinct from {@link LogLevel} because `silent` is only ever a filter: no log
 * record can *be* silent, but a consumer can choose to suppress every record.
 */
export type LogThreshold = LogLevel | "silent";
