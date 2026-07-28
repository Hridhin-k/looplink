import type { TrafficRecord } from "../traffic/traffic-record.js";
import { DEFAULT_REQUESTS_PER_MINUTE_WINDOW_MS, DEFAULT_TOP_ENDPOINTS_LIMIT } from "./constants.js";
import type {
  ComputeTrafficStatisticsOptions,
  EndpointCount,
  MethodCount,
  StatusCodeCount,
  TrafficStatistics,
  TunnelStatistics,
} from "./traffic-statistics.js";

/**
 * Computes aggregate traffic statistics from recorded exchanges.
 *
 * Pure function — no I/O. Callers load records from
 * {@link import("../traffic/traffic-record-store.js").TrafficRecordStore}.
 *
 * @param records - Traffic records to aggregate (bodies are ignored).
 * @param options - Optional time window and ranking limits.
 * @returns Immutable aggregate statistics.
 */
export function computeTrafficStatistics(
  records: readonly TrafficRecord[],
  options: ComputeTrafficStatisticsOptions = {},
): TrafficStatistics {
  const nowMs = options.nowMs ?? Date.now();
  const windowMs = options.requestsPerMinuteWindowMs ?? DEFAULT_REQUESTS_PER_MINUTE_WINDOW_MS;
  const topLimit = options.topEndpointsLimit ?? DEFAULT_TOP_ENDPOINTS_LIMIT;
  const sinceMs = options.sinceMs;

  if (windowMs <= 0 || !Number.isFinite(windowMs)) {
    throw new Error(
      `requestsPerMinuteWindowMs must be a positive number, received ${String(windowMs)}.`,
    );
  }

  if (topLimit < 0 || !Number.isInteger(topLimit)) {
    throw new Error(
      `topEndpointsLimit must be a non-negative integer, received ${String(topLimit)}.`,
    );
  }

  const filtered =
    sinceMs === undefined ? records : records.filter((record) => record.timestamp >= sinceMs);

  const aggregate = aggregateRecords(filtered, nowMs, windowMs, topLimit);

  const tunnels: TunnelStatistics[] = options.omitTunnelBreakdown
    ? []
    : buildTunnelStatistics(filtered, nowMs, windowMs, topLimit);

  return {
    totalRequests: aggregate.totalRequests,
    requestsPerMinute: aggregate.requestsPerMinute,
    averageLatencyMs: aggregate.averageLatencyMs,
    p95LatencyMs: aggregate.p95LatencyMs,
    errorRate: aggregate.errorRate,
    methodCounts: aggregate.methodCounts,
    statusCodeCounts: aggregate.statusCodeCounts,
    topEndpoints: aggregate.topEndpoints,
    tunnels,
  };
}

/**
 * Shared aggregate fields (without tunnel breakdown).
 */
interface AggregateSlice {
  readonly totalRequests: number;
  readonly requestsPerMinute: number;
  readonly averageLatencyMs: number | undefined;
  readonly p95LatencyMs: number | undefined;
  readonly errorRate: number;
  readonly methodCounts: readonly MethodCount[];
  readonly statusCodeCounts: readonly StatusCodeCount[];
  readonly topEndpoints: readonly EndpointCount[];
}

/**
 * Aggregates a flat list of records.
 *
 * @param records - Filtered records.
 * @param nowMs - End of the RPM window.
 * @param windowMs - RPM window length.
 * @param topLimit - Max endpoints.
 * @returns Aggregate slice.
 */
function aggregateRecords(
  records: readonly TrafficRecord[],
  nowMs: number,
  windowMs: number,
  topLimit: number,
): AggregateSlice {
  const totalRequests = records.length;
  const windowStart = nowMs - windowMs;
  let requestsInWindow = 0;
  let errorCount = 0;
  const latencies: number[] = [];
  const methods = new Map<string, number>();
  const statuses = new Map<number, number>();
  const endpoints = new Map<string, EndpointCount>();

  for (const record of records) {
    if (record.timestamp >= windowStart && record.timestamp <= nowMs) {
      requestsInWindow += 1;
    }

    if (isErrorRecord(record)) {
      errorCount += 1;
    }

    if (record.latencyMs !== undefined) {
      latencies.push(record.latencyMs);
    }

    increment(methods, record.method);

    if (record.status !== undefined) {
      increment(statuses, record.status);
    }

    const endpointKey = `${record.method} ${record.path}`;
    const existing = endpoints.get(endpointKey);
    if (existing === undefined) {
      endpoints.set(endpointKey, {
        method: record.method,
        path: record.path,
        count: 1,
      });
    } else {
      endpoints.set(endpointKey, {
        method: existing.method,
        path: existing.path,
        count: existing.count + 1,
      });
    }
  }

  return {
    totalRequests,
    requestsPerMinute: scaleToPerMinute(requestsInWindow, windowMs),
    averageLatencyMs: average(latencies),
    p95LatencyMs: percentileNearestRank(latencies, 0.95),
    errorRate: totalRequests === 0 ? 0 : errorCount / totalRequests,
    methodCounts: sortMethodCounts(methods),
    statusCodeCounts: sortStatusCounts(statuses),
    topEndpoints: sortEndpoints([...endpoints.values()], topLimit),
  };
}

/**
 * Builds per-tunnel statistics.
 *
 * @param records - Filtered records.
 * @param nowMs - End of the RPM window.
 * @param windowMs - RPM window length.
 * @param topLimit - Max endpoints per tunnel.
 * @returns Tunnel stats sorted by totalRequests descending.
 */
function buildTunnelStatistics(
  records: readonly TrafficRecord[],
  nowMs: number,
  windowMs: number,
  topLimit: number,
): TunnelStatistics[] {
  const byTunnel = new Map<string, TrafficRecord[]>();

  for (const record of records) {
    const bucket = byTunnel.get(record.tunnelId);
    if (bucket === undefined) {
      byTunnel.set(record.tunnelId, [record]);
    } else {
      bucket.push(record);
    }
  }

  const tunnels: TunnelStatistics[] = [];

  for (const [tunnelId, tunnelRecords] of byTunnel) {
    const aggregate = aggregateRecords(tunnelRecords, nowMs, windowMs, topLimit);
    tunnels.push({
      tunnelId,
      totalRequests: aggregate.totalRequests,
      averageLatencyMs: aggregate.averageLatencyMs,
      p95LatencyMs: aggregate.p95LatencyMs,
      errorRate: aggregate.errorRate,
      methodCounts: aggregate.methodCounts,
      statusCodeCounts: aggregate.statusCodeCounts,
      topEndpoints: aggregate.topEndpoints,
    });
  }

  tunnels.sort((left, right) => {
    if (right.totalRequests !== left.totalRequests) {
      return right.totalRequests - left.totalRequests;
    }
    return left.tunnelId.localeCompare(right.tunnelId);
  });

  return tunnels;
}

/**
 * Treats a record as an error when it has an explicit failure or a 4xx/5xx status.
 *
 * @param record - Traffic record.
 * @returns `true` when the exchange is counted as an error.
 */
function isErrorRecord(record: TrafficRecord): boolean {
  if (record.error !== undefined) {
    return true;
  }

  return record.status !== undefined && record.status >= 400;
}

/**
 * Scales a count observed in `windowMs` to a per-minute rate.
 *
 * @param count - Observations in the window.
 * @param windowMs - Window length in milliseconds.
 * @returns Requests per minute.
 */
function scaleToPerMinute(count: number, windowMs: number): number {
  return (count * 60_000) / windowMs;
}

/**
 * @param values - Numeric samples.
 * @returns Arithmetic mean, or `undefined` when empty.
 */
function average(values: readonly number[]): number | undefined {
  if (values.length === 0) {
    return undefined;
  }

  let sum = 0;
  for (const value of values) {
    sum += value;
  }

  return sum / values.length;
}

/**
 * Nearest-rank percentile over a copy of `values`.
 *
 * @param values - Numeric samples (unsorted).
 * @param percentile - Fraction in `(0, 1]`.
 * @returns Percentile value, or `undefined` when empty.
 */
function percentileNearestRank(values: readonly number[], percentile: number): number | undefined {
  if (values.length === 0) {
    return undefined;
  }

  const sorted = [...values].sort((left, right) => left - right);
  const rank = Math.ceil(percentile * sorted.length) - 1;
  const index = Math.min(sorted.length - 1, Math.max(0, rank));
  return sorted[index];
}

/**
 * @param map - Counter map.
 * @param key - Key to increment.
 */
function increment<T>(map: Map<T, number>, key: T): void {
  map.set(key, (map.get(key) ?? 0) + 1);
}

/**
 * @param methods - Method → count.
 * @returns Sorted method counts.
 */
function sortMethodCounts(methods: Map<string, number>): MethodCount[] {
  return [...methods.entries()]
    .map(([method, count]) => ({ method, count }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return left.method.localeCompare(right.method);
    });
}

/**
 * @param statuses - Status → count.
 * @returns Sorted status counts.
 */
function sortStatusCounts(statuses: Map<number, number>): StatusCodeCount[] {
  return [...statuses.entries()]
    .map(([statusCode, count]) => ({ statusCode, count }))
    .sort((left, right) => {
      if (right.count !== left.count) {
        return right.count - left.count;
      }
      return left.statusCode - right.statusCode;
    });
}

/**
 * @param endpoints - Endpoint aggregates.
 * @param limit - Max entries.
 * @returns Top endpoints.
 */
function sortEndpoints(endpoints: readonly EndpointCount[], limit: number): EndpointCount[] {
  const sorted = [...endpoints].sort((left, right) => {
    if (right.count !== left.count) {
      return right.count - left.count;
    }
    const methodCmp = left.method.localeCompare(right.method);
    if (methodCmp !== 0) {
      return methodCmp;
    }
    return left.path.localeCompare(right.path);
  });

  return sorted.slice(0, limit);
}
