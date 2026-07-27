import { Global, Module } from "@nestjs/common";
import { EVENT_BUS, createEventBus, type EventBus } from "@hridhin-k/badger-shared";

/**
 * Provides a process-wide {@link EventBus} for lifecycle observability.
 *
 * Marked `@Global()` so gateway, tunnel, and HTTP modules share one instance
 * without re-importing. Publishing is fire-and-forget; subscribers are optional.
 */
@Global()
@Module({
  providers: [
    {
      provide: EVENT_BUS,
      useFactory: (): EventBus => createEventBus(),
    },
  ],
  exports: [EVENT_BUS],
})
export class EventModule {}
