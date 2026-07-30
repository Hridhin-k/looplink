import { Global, Module } from "@nestjs/common";

import { ConsoleMonitoringHooks, MONITORING_HOOKS } from "./monitoring.hooks.js";
import { StructuredLogger } from "./structured-logger.js";

/**
 * Structured logging + monitoring hooks available application-wide.
 */
@Global()
@Module({
  providers: [
    StructuredLogger,
    ConsoleMonitoringHooks,
    {
      provide: MONITORING_HOOKS,
      useExisting: ConsoleMonitoringHooks,
    },
  ],
  exports: [StructuredLogger, MONITORING_HOOKS, ConsoleMonitoringHooks],
})
export class ObservabilityModule {}
