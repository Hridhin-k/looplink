import { Inject, Injectable } from "@nestjs/common";
import {
  StatisticsService as SharedStatisticsService,
  TRAFFIC_RECORD_STORE,
  type GetStatisticsOptions,
  type TrafficRecordStore,
  type TrafficStatistics,
} from "@hridhin-k/badger-shared";

/**
 * Nest adapter over the shared {@link SharedStatisticsService}.
 *
 * Reads recorded traffic through {@link TRAFFIC_RECORD_STORE}. No REST surface.
 */
@Injectable()
export class StatisticsService {
  private readonly statistics: SharedStatisticsService;

  /**
   * @param store - Traffic persistence port.
   */
  constructor(@Inject(TRAFFIC_RECORD_STORE) store: TrafficRecordStore) {
    this.statistics = new SharedStatisticsService(store);
  }

  /**
   * Computes statistics over currently retained traffic records.
   *
   * @param options - Optional tunnel filter, time window, and ranking limits.
   * @returns Aggregate statistics.
   */
  getStatistics(options?: GetStatisticsOptions): Promise<TrafficStatistics> {
    return this.statistics.getStatistics(options);
  }
}
