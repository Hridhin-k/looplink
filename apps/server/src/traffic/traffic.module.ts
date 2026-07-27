import { Module } from "@nestjs/common";

import { MemoryTrafficRecordStore } from "./memory-traffic-record.store.js";
import { TRAFFIC_RECORD_STORE } from "./traffic.constants.js";
import { TrafficRecorderService } from "./traffic-recorder.service.js";

/**
 * Records HTTP traffic by subscribing to the shared EventBus.
 *
 * Does not participate in request forwarding. Storage is in-memory by default
 * behind {@link import("./traffic-record.store.js").TrafficRecordStore}.
 */
@Module({
  providers: [
    {
      provide: TRAFFIC_RECORD_STORE,
      useFactory: (): MemoryTrafficRecordStore => new MemoryTrafficRecordStore(),
    },
    TrafficRecorderService,
  ],
  exports: [TrafficRecorderService, TRAFFIC_RECORD_STORE],
})
export class TrafficModule {}
