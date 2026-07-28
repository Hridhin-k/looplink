import { Global, Module } from "@nestjs/common";

import { createEventBus, EVENT_BUS } from "@hridhin-k/badger-shared";

/**
 * Provides a process-wide {@link import("@hridhin-k/badger-shared").EventBus}.
 *
 * Import this module to inject `EVENT_BUS`. It does not alter tunnel protocol
 * or HTTP forwarding — publishers opt in explicitly.
 */
@Global()
@Module({
  providers: [
    {
      provide: EVENT_BUS,
      useFactory: createEventBus,
    },
  ],
  exports: [EVENT_BUS],
})
export class EventModule {}
