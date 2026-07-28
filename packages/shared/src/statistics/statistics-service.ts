import type { TrafficRecordStore } from "../traffic/traffic-record-store.js";
import { computeTrafficStatistics } from "./compute-traffic-statistics.js";
import type { ComputeTrafficStatisticsOptions, TrafficStatistics } from "./traffic-statistics.js";

/**
 * Options for {@link StatisticsService.getStatistics}.
 */
export interface GetStatisticsOptions extends ComputeTrafficStatisticsOptions {
  /** When set, only records for this tunnel are included. */
  readonly tunnelId?: string;
}

/**
 * Reads recorded traffic and produces aggregate statistics.
 *
 * Depends only on {@link TrafficRecordStore} — never on forwarding modules or a
 * concrete storage backend.
 */
export class StatisticsService {
  /**
   * @param store - Traffic persistence port.
   */
  constructor(private readonly store: TrafficRecordStore) {}

  /**
   * Computes statistics over currently retained traffic records.
   *
   * @param options - Optional tunnel filter, time window, and ranking limits.
   * @returns Aggregate statistics (bodies are not loaded).
   */
  async getStatistics(options: GetStatisticsOptions = {}): Promise<TrafficStatistics> {
    const records = await this.store.list({
      ...(options.tunnelId === undefined ? {} : { tunnelId: options.tunnelId }),
      includeBodies: false,
    });

    return computeTrafficStatistics(records, {
      ...(options.sinceMs === undefined ? {} : { sinceMs: options.sinceMs }),
      ...(options.nowMs === undefined ? {} : { nowMs: options.nowMs }),
      ...(options.requestsPerMinuteWindowMs === undefined
        ? {}
        : { requestsPerMinuteWindowMs: options.requestsPerMinuteWindowMs }),
      ...(options.topEndpointsLimit === undefined
        ? {}
        : { topEndpointsLimit: options.topEndpointsLimit }),
      omitTunnelBreakdown: options.tunnelId !== undefined || options.omitTunnelBreakdown === true,
    });
  }
}
