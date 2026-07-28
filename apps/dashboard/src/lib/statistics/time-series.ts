import type { InspectorRequestSummary } from "@/lib/api";

/** Default chart window: last 30 minutes. */
export const DEFAULT_STATS_WINDOW_MS = 30 * 60 * 1_000;

/** Default bucket size: 1 minute. */
export const DEFAULT_STATS_BUCKET_MS = 60 * 1_000;

/**
 * One time bucket for requests / latency / per-tunnel activity charts.
 */
export interface StatsTimeBucket {
  /** Bucket start epoch ms. */
  readonly t: number;
  /** Short axis label. */
  readonly label: string;
  /** Requests whose timestamp falls in this bucket. */
  readonly requests: number;
  /** Mean latency for samples that include `latencyMs`. */
  readonly avgLatencyMs: number | null;
  /** Request count keyed by tunnel id. */
  readonly byTunnel: Readonly<Record<string, number>>;
}

/**
 * Builds evenly spaced time buckets from request summaries.
 *
 * Buckets cover `[end - windowMs, end)` (default: last 30 minutes ending now).
 * Requests outside the window are ignored.
 *
 * @param items - Inspector request summaries.
 * @param options - Window / bucket size and optional clock override.
 * @returns Ordered buckets oldest → newest.
 */
export function buildStatsTimeSeries(
  items: readonly InspectorRequestSummary[],
  options?: {
    readonly windowMs?: number;
    readonly bucketMs?: number;
    readonly nowMs?: number;
  },
): readonly StatsTimeBucket[] {
  const windowMs = options?.windowMs ?? DEFAULT_STATS_WINDOW_MS;
  const bucketMs = options?.bucketMs ?? DEFAULT_STATS_BUCKET_MS;
  const nowMs = options?.nowMs ?? Date.now();

  const end = alignUp(nowMs, bucketMs);
  const start = end - windowMs;
  const bucketCount = Math.max(1, Math.ceil(windowMs / bucketMs));

  const buckets: Array<{
    t: number;
    requests: number;
    latencySum: number;
    latencyCount: number;
    byTunnel: Record<string, number>;
  }> = [];

  for (let i = 0; i < bucketCount; i += 1) {
    buckets.push({
      t: start + i * bucketMs,
      requests: 0,
      latencySum: 0,
      latencyCount: 0,
      byTunnel: {},
    });
  }

  for (const item of items) {
    if (item.timestamp < start || item.timestamp >= end) {
      continue;
    }

    const index = Math.min(bucketCount - 1, Math.floor((item.timestamp - start) / bucketMs));
    const bucket = buckets[index]!;
    bucket.requests += 1;
    bucket.byTunnel[item.tunnelId] = (bucket.byTunnel[item.tunnelId] ?? 0) + 1;

    if (item.latencyMs !== undefined) {
      bucket.latencySum += item.latencyMs;
      bucket.latencyCount += 1;
    }
  }

  return buckets.map((bucket) => ({
    t: bucket.t,
    label: formatBucketLabel(bucket.t),
    requests: bucket.requests,
    avgLatencyMs: bucket.latencyCount === 0 ? null : bucket.latencySum / bucket.latencyCount,
    byTunnel: bucket.byTunnel,
  }));
}

/**
 * Collects tunnel ids that appear in any bucket, sorted by total activity desc.
 *
 * @param series - Time series buckets.
 * @param limit - Max tunnels to include (rest can be grouped as "other" by caller).
 */
export function topTunnelIdsFromSeries(
  series: readonly StatsTimeBucket[],
  limit = 5,
): readonly string[] {
  const totals = new Map<string, number>();
  for (const bucket of series) {
    for (const [tunnelId, count] of Object.entries(bucket.byTunnel)) {
      totals.set(tunnelId, (totals.get(tunnelId) ?? 0) + count);
    }
  }

  return [...totals.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, limit)
    .map(([id]) => id);
}

function alignUp(value: number, step: number): number {
  return Math.ceil(value / step) * step;
}

function formatBucketLabel(epochMs: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).format(new Date(epochMs));
  } catch {
    return new Date(epochMs).toISOString().slice(11, 16);
  }
}
