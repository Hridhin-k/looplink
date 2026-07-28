import { Module } from "@nestjs/common";
import {
  STORAGE_PROVIDER,
  StorageTrafficRecordStore,
  TRAFFIC_RECORD_STORE,
  type StorageProvider,
} from "@hridhin-k/badger-shared";

import { TrafficRecorderService } from "./traffic-recorder.service.js";

/**
 * Records HTTP traffic by subscribing to the shared EventBus.
 *
 * Persists through {@link StorageTrafficRecordStore} on top of
 * `STORAGE_PROVIDER`. Does not participate in request forwarding.
 */
@Module({
  providers: [
    {
      provide: TRAFFIC_RECORD_STORE,
      useFactory: (storage: StorageProvider): StorageTrafficRecordStore =>
        new StorageTrafficRecordStore(storage),
      inject: [STORAGE_PROVIDER],
    },
    TrafficRecorderService,
  ],
  exports: [TrafficRecorderService, TRAFFIC_RECORD_STORE],
})
export class TrafficModule {}
