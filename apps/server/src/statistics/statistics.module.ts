import { Module } from "@nestjs/common";
import {
  STATISTICS_SERVICE,
  StatisticsService as SharedStatisticsService,
  TRAFFIC_RECORD_STORE,
  type TrafficRecordStore,
} from "@hridhin-k/badger-shared";

import { TrafficModule } from "../traffic/traffic.module.js";
import { StatisticsService } from "./statistics.service.js";

/**
 * Provides {@link StatisticsService} over recorded traffic.
 *
 * No REST controllers — consumers inject the service directly for now.
 */
@Module({
  imports: [TrafficModule],
  providers: [
    StatisticsService,
    {
      provide: STATISTICS_SERVICE,
      useFactory: (store: TrafficRecordStore): SharedStatisticsService =>
        new SharedStatisticsService(store),
      inject: [TRAFFIC_RECORD_STORE],
    },
  ],
  exports: [StatisticsService, STATISTICS_SERVICE],
})
export class StatisticsModule {}
