import { Injectable } from "@nestjs/common";

import { StructuredLogger } from "./structured-logger.js";

/**
 * Lightweight monitoring port for error / security / operational signals.
 *
 * Production can wire Sentry (or similar) via `BADGER_MONITORING_DSN` without
 * coupling domain code to a vendor SDK.
 */
export interface MonitoringHooks {
  captureException(error: unknown, context?: Record<string, string>): void;
  captureMessage(message: string, level?: "info" | "warning" | "error"): void;
  increment(metric: string, tags?: Record<string, string>): void;
}

export const MONITORING_HOOKS = Symbol("MONITORING_HOOKS");

@Injectable()
export class ConsoleMonitoringHooks implements MonitoringHooks {
  constructor(private readonly logger: StructuredLogger) {}

  captureException(error: unknown, context: Record<string, string> = {}): void {
    const message = error instanceof Error ? error.message : String(error);
    this.logger.error("monitoring.exception", {
      error: message,
      ...context,
    });
  }

  captureMessage(message: string, level: "info" | "warning" | "error" = "info"): void {
    if (level === "error") {
      this.logger.error(message);
      return;
    }
    if (level === "warning") {
      this.logger.warn(message);
      return;
    }
    this.logger.log(message);
  }

  increment(metric: string, tags: Record<string, string> = {}): void {
    this.logger.debug("monitoring.increment", { metric, ...tags });
  }
}
