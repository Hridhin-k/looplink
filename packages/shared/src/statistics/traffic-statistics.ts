/**
 * Count for a single HTTP method.
 */
export interface MethodCount {
  /** HTTP method name (for example `GET`). */
  readonly method: string;
  /** Number of recorded exchanges using this method. */
  readonly count: number;
}

/**
 * Count for a single HTTP status code.
 */
export interface StatusCodeCount {
  /** HTTP status code. */
  readonly statusCode: number;
  /** Number of recorded exchanges that completed with this status. */
  readonly count: number;
}

/**
 * Ranked endpoint usage entry.
 */
export interface EndpointCount {
  /** Request path. */
  readonly path: string;
  /** HTTP method. */
  readonly method: string;
  /** Number of recorded exchanges for this method + path. */
  readonly count: number;
}

/**
 * Aggregated statistics for one tunnel.
 */
export interface TunnelStatistics {
  /** Tunnel identifier. */
  readonly tunnelId: string;
  /** Total recorded exchanges for this tunnel. */
  readonly totalRequests: number;
  /** Average latency in ms when at least one sample exists. */
  readonly averageLatencyMs: number | undefined;
  /** 95th-percentile latency in ms when at least one sample exists. */
  readonly p95LatencyMs: number | undefined;
  /** Fraction of exchanges considered errors (`0`–`1`). */
  readonly errorRate: number;
  /** Method histogram, sorted by count descending then method name. */
  readonly methodCounts: readonly MethodCount[];
  /** Status histogram, sorted by count descending then status code. */
  readonly statusCodeCounts: readonly StatusCodeCount[];
  /** Top endpoints for this tunnel. */
  readonly topEndpoints: readonly EndpointCount[];
}

/**
 * Aggregated traffic statistics computed from {@link import("../traffic/traffic-record.js").TrafficRecord}s.
 */
export interface TrafficStatistics {
  /** Total recorded exchanges in the selected set. */
  readonly totalRequests: number;
  /**
   * Requests observed in the rolling window ending at `nowMs`
   * (default window: 60 seconds). Equivalent to requests per minute for a
   * 60s window.
   */
  readonly requestsPerMinute: number;
  /** Average latency in ms when at least one sample exists. */
  readonly averageLatencyMs: number | undefined;
  /** 95th-percentile latency in ms when at least one sample exists. */
  readonly p95LatencyMs: number | undefined;
  /** Fraction of exchanges considered errors (`0`–`1`). */
  readonly errorRate: number;
  /** Method histogram, sorted by count descending then method name. */
  readonly methodCounts: readonly MethodCount[];
  /** Status histogram, sorted by count descending then status code. */
  readonly statusCodeCounts: readonly StatusCodeCount[];
  /** Top endpoints across the selected set. */
  readonly topEndpoints: readonly EndpointCount[];
  /** Per-tunnel breakdown (omitted when already filtered to one tunnel). */
  readonly tunnels: readonly TunnelStatistics[];
}

/**
 * Options for computing traffic statistics.
 */
export interface ComputeTrafficStatisticsOptions {
  /** Inclusive lower bound on {@link import("../traffic/traffic-record.js").TrafficRecord.timestamp}. */
  readonly sinceMs?: number;
  /** Exclusive upper bound / "now" for the requests-per-minute window. */
  readonly nowMs?: number;
  /** Rolling window length for requests-per-minute (default 60_000). */
  readonly requestsPerMinuteWindowMs?: number;
  /** Maximum endpoints to return (default 10). */
  readonly topEndpointsLimit?: number;
  /**
   * When `true`, skip the per-tunnel breakdown (used when already scoped to one
   * tunnel).
   *
   * @defaultValue false
   */
  readonly omitTunnelBreakdown?: boolean;
}
