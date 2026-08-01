import type {
  EndpointCount,
  InspectorRequestSummary,
  InspectorStatistics,
  TunnelStatistics,
} from "@/lib/api";
import type { StatsTimeBucket } from "@/lib/statistics/time-series";

export interface EndpointInsight {
  readonly method: string;
  readonly path: string;
  readonly count: number;
  readonly averageLatencyMs?: number;
  readonly errorRate?: number;
  readonly totalBytes?: number;
}

export interface TrafficTrendInsight {
  readonly direction: "up" | "down" | "flat" | "empty";
  readonly changePercent: number;
  readonly recentCount: number;
  readonly earlierCount: number;
  readonly label: string;
  readonly detail: string;
}

export interface StatisticsInsights {
  readonly mostActiveEndpoint: EndpointInsight | null;
  readonly slowestEndpoint: EndpointInsight | null;
  readonly largestPayload: {
    readonly method: string;
    readonly path: string;
    readonly totalBytes: number;
    readonly requestBytes: number;
    readonly responseBytes: number;
    readonly id: string;
  } | null;
  readonly highestErrorRate: {
    readonly scope: "tunnel" | "overall";
    readonly label: string;
    readonly errorRate: number;
    readonly totalRequests: number;
  } | null;
  readonly trafficTrend: TrafficTrendInsight;
  readonly topTunnels: readonly TunnelStatistics[];
}

/**
 * Derives insight answers from existing statistics + retained request summaries.
 * No additional API calls.
 */
export function buildStatisticsInsights(
  stats: InspectorStatistics,
  requests: readonly InspectorRequestSummary[],
  series: readonly StatsTimeBucket[],
): StatisticsInsights {
  const mostActive = stats.topEndpoints[0];
  const mostActiveEndpoint =
    mostActive === undefined
      ? null
      : {
          method: mostActive.method,
          path: mostActive.path,
          count: mostActive.count,
        };

  const slowestEndpoint = findSlowestEndpoint(requests);
  const largestPayload = findLargestPayload(requests);
  const highestErrorRate = findHighestErrorRate(stats);
  const trafficTrend = computeTrafficTrend(series);
  const topTunnels = [...stats.tunnels].sort((a, b) => b.totalRequests - a.totalRequests);

  return {
    mostActiveEndpoint,
    slowestEndpoint,
    largestPayload,
    highestErrorRate,
    trafficTrend,
    topTunnels,
  };
}

function findSlowestEndpoint(
  requests: readonly InspectorRequestSummary[],
): EndpointInsight | null {
  const groups = new Map<
    string,
    { method: string; path: string; latencySum: number; latencyCount: number; count: number }
  >();

  for (const item of requests) {
    if (item.latencyMs === undefined) {
      continue;
    }
    const key = `${item.method.toUpperCase()} ${item.path}`;
    const existing = groups.get(key);
    if (existing === undefined) {
      groups.set(key, {
        method: item.method.toUpperCase(),
        path: item.path,
        latencySum: item.latencyMs,
        latencyCount: 1,
        count: 1,
      });
    } else {
      existing.latencySum += item.latencyMs;
      existing.latencyCount += 1;
      existing.count += 1;
    }
  }

  let slowest: EndpointInsight | null = null;
  for (const group of groups.values()) {
    if (group.latencyCount < 1) {
      continue;
    }
    const averageLatencyMs = group.latencySum / group.latencyCount;
    if (slowest === null || (slowest.averageLatencyMs ?? 0) < averageLatencyMs) {
      slowest = {
        method: group.method,
        path: group.path,
        count: group.count,
        averageLatencyMs,
      };
    }
  }

  return slowest;
}

function findLargestPayload(requests: readonly InspectorRequestSummary[]): StatisticsInsights["largestPayload"] {
  let largest: StatisticsInsights["largestPayload"] = null;

  for (const item of requests) {
    const totalBytes = item.requestBodyByteLength + item.responseBodyByteLength;
    if (largest === null || totalBytes > largest.totalBytes) {
      largest = {
        method: item.method.toUpperCase(),
        path: item.path,
        totalBytes,
        requestBytes: item.requestBodyByteLength,
        responseBytes: item.responseBodyByteLength,
        id: item.id,
      };
    }
  }

  return largest !== null && largest.totalBytes > 0 ? largest : largest;
}

function findHighestErrorRate(
  stats: InspectorStatistics,
): StatisticsInsights["highestErrorRate"] {
  const qualified = stats.tunnels.filter((tunnel) => tunnel.totalRequests >= 3);
  const pool = qualified.length > 0 ? qualified : stats.tunnels;

  let worst: TunnelStatistics | null = null;
  for (const tunnel of pool) {
    if (worst === null || tunnel.errorRate > worst.errorRate) {
      worst = tunnel;
    }
  }

  if (worst !== null && worst.errorRate > 0) {
    return {
      scope: "tunnel",
      label: worst.tunnelId,
      errorRate: worst.errorRate,
      totalRequests: worst.totalRequests,
    };
  }

  if (stats.totalRequests === 0) {
    return null;
  }

  return {
    scope: "overall",
    label: "All traffic",
    errorRate: stats.errorRate,
    totalRequests: stats.totalRequests,
  };
}

function computeTrafficTrend(series: readonly StatsTimeBucket[]): TrafficTrendInsight {
  if (series.length === 0) {
    return {
      direction: "empty",
      changePercent: 0,
      recentCount: 0,
      earlierCount: 0,
      label: "No trend yet",
      detail: "Need traffic in the last 30 minutes",
    };
  }

  const mid = Math.floor(series.length / 2);
  const earlier = series.slice(0, mid);
  const recent = series.slice(mid);
  const earlierCount = earlier.reduce((sum, bucket) => sum + bucket.requests, 0);
  const recentCount = recent.reduce((sum, bucket) => sum + bucket.requests, 0);

  if (earlierCount === 0 && recentCount === 0) {
    return {
      direction: "empty",
      changePercent: 0,
      recentCount,
      earlierCount,
      label: "Quiet window",
      detail: "No requests in the last 30 minutes",
    };
  }

  if (earlierCount === 0) {
    return {
      direction: "up",
      changePercent: 100,
      recentCount,
      earlierCount,
      label: "Traffic appearing",
      detail: `${String(recentCount)} requests in the recent half`,
    };
  }

  const changePercent = ((recentCount - earlierCount) / earlierCount) * 100;
  if (Math.abs(changePercent) < 8) {
    return {
      direction: "flat",
      changePercent,
      recentCount,
      earlierCount,
      label: "Steady traffic",
      detail: `${String(recentCount)} vs ${String(earlierCount)} earlier`,
    };
  }

  if (changePercent > 0) {
    return {
      direction: "up",
      changePercent,
      recentCount,
      earlierCount,
      label: `Up ${formatPercent(changePercent)}`,
      detail: `${String(recentCount)} recent vs ${String(earlierCount)} earlier`,
    };
  }

  return {
    direction: "down",
    changePercent,
    recentCount,
    earlierCount,
    label: `Down ${formatPercent(Math.abs(changePercent))}`,
    detail: `${String(recentCount)} recent vs ${String(earlierCount)} earlier`,
  };
}

function formatPercent(value: number): string {
  return `${value >= 10 ? value.toFixed(0) : value.toFixed(1)}%`;
}

/**
 * Formats byte counts for insight cards.
 */
export function formatInsightBytes(bytes: number): string {
  if (bytes < 1024) {
    return `${String(bytes)} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(bytes >= 10_240 ? 0 : 1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Formats latency for insight cards.
 */
export function formatInsightLatency(ms: number | undefined): string {
  if (ms === undefined) {
    return "—";
  }
  if (ms < 1_000) {
    return `${Math.round(ms)} ms`;
  }
  return `${(ms / 1_000).toFixed(2)} s`;
}

/**
 * Truncates a path for dense insight answers.
 */
export function truncatePath(path: string, max = 42): string {
  if (path.length <= max) {
    return path;
  }
  return `${path.slice(0, max - 1)}…`;
}

export function endpointLabel(endpoint: Pick<EndpointCount, "method" | "path">): string {
  return `${endpoint.method.toUpperCase()} ${endpoint.path}`;
}
