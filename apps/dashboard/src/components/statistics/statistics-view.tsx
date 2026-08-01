"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

import { LiveMeta, MetricBand } from "@/components/layout/surface";
import { PageHeader } from "@/components/layout/page-header";
import { InsightCard } from "@/components/statistics/insight-card";
import { LatencyOverTimeChart } from "@/components/statistics/latency-over-time-chart";
import { MethodsChart } from "@/components/statistics/methods-chart";
import { RequestsOverTimeChart } from "@/components/statistics/requests-over-time-chart";
import { StatKpi } from "@/components/statistics/stat-kpi";
import { StatusDistributionChart } from "@/components/statistics/status-distribution-chart";
import { TunnelActivityChart } from "@/components/statistics/tunnel-activity-chart";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useInspectorRequests } from "@/hooks/use-inspector-requests";
import { useInspectorStatistics } from "@/hooks/use-inspector-statistics";
import { ApiError, NetworkError } from "@/lib/api";
import {
  buildStatisticsInsights,
  formatInsightBytes,
  formatInsightLatency,
  truncatePath,
} from "@/lib/statistics/insights";
import { buildStatsTimeSeries } from "@/lib/statistics/time-series";
import { useConnectionStore } from "@/stores/connection-store";

/**
 * Statistics — insight-first answers, charts as supporting visuals.
 *
 * Aggregates from `GET /api/v1/inspector/statistics`. Time-series and endpoint
 * latency/payload insights are derived client-side from retained summaries.
 */
export function StatisticsView() {
  const live = useConnectionStore((s) => s.status) === "connected";

  const {
    data: stats,
    isPending: statsPending,
    isError: statsError,
    error: statsErr,
    refetch: refetchStats,
    isFetching: statsFetching,
  } = useInspectorStatistics();

  const {
    data: requests,
    isPending: requestsPending,
    isError: requestsError,
    error: requestsErr,
    refetch: refetchRequests,
  } = useInspectorRequests({ limit: 1_000 });

  const items = requests?.items ?? [];
  const series = useMemo(() => buildStatsTimeSeries(items), [items]);
  const insights = useMemo(
    () => (stats === undefined ? null : buildStatisticsInsights(stats, items, series)),
    [stats, items, series],
  );

  if (statsPending && requestsPending) {
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Statistics" title="Traffic insights" meta={<LiveMeta live={live} />} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-36 rounded-[10px]" />
          ))}
        </div>
        <Skeleton className="h-24 w-full rounded-[10px]" />
        <div className="grid gap-4 lg:grid-cols-2">
          <Skeleton className="h-72 w-full rounded-[10px]" />
          <Skeleton className="h-72 w-full rounded-[10px]" />
        </div>
      </div>
    );
  }

  if (statsError) {
    return (
      <div className="space-y-8">
        <PageHeader eyebrow="Statistics" title="Traffic insights" meta={<LiveMeta live={live} />} />
        <Alert variant="destructive">
          <AlertTitle>Could not load statistics</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <p className="font-mono text-xs">{formatError(statsErr)}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => {
                void refetchStats();
                void refetchRequests();
              }}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (stats === undefined || insights === null) {
    return null;
  }

  const errorCount = Math.round(stats.errorRate * stats.totalRequests);
  const errorPercent = `${(stats.errorRate * 100).toFixed(stats.errorRate > 0 && stats.errorRate < 0.01 ? 2 : 1)}%`;
  const emptyTraffic = stats.totalRequests === 0 && items.length === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className="flex flex-col gap-10"
    >
      <PageHeader
        eyebrow="Statistics"
        title="Traffic insights"
        description={
          <>
            Answers from {stats.totalRequests} retained{" "}
            {stats.totalRequests === 1 ? "exchange" : "exchanges"}
            {statsFetching ? " · refreshing…" : null}
          </>
        }
        meta={<LiveMeta live={live} liveLabel="Live" idleLabel="Idle" />}
      />

      <section className="space-y-4" aria-label="Insights">
        <div>
          <p className="text-caption text-pale-stone">Insights</p>
          <h2 className="mt-1.5 text-xl tracking-tight text-bone">What is the traffic telling you?</h2>
        </div>

        {emptyTraffic ? (
          <div className="rounded-[10px] border border-dashed border-ash-stroke px-5 py-10 text-center">
            <p className="text-sm text-warm-granite">
              No retained traffic yet. Insights appear once the tunnel records exchanges.
            </p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <InsightCard
              question="Most active endpoint"
              answer={
                insights.mostActiveEndpoint === null ? (
                  "—"
                ) : (
                  <span className="font-mono text-lg sm:text-xl">
                    {insights.mostActiveEndpoint.method}{" "}
                    {truncatePath(insights.mostActiveEndpoint.path)}
                  </span>
                )
              }
              detail={
                insights.mostActiveEndpoint === null
                  ? "No endpoint histogram yet"
                  : `${String(insights.mostActiveEndpoint.count)} requests in retained traffic`
              }
            />

            <InsightCard
              question="Slowest endpoint"
              answer={
                insights.slowestEndpoint === null ? (
                  <span className="text-warm-granite">—</span>
                ) : (
                  formatInsightLatency(insights.slowestEndpoint.averageLatencyMs)
                )
              }
              detail={
                insights.slowestEndpoint === null ? (
                  "Need completed requests with latency"
                ) : (
                  <span className="font-mono text-xs text-warm-granite">
                    {insights.slowestEndpoint.method} {truncatePath(insights.slowestEndpoint.path)} ·{" "}
                    {String(insights.slowestEndpoint.count)} samples
                  </span>
                )
              }
              tone={
                insights.slowestEndpoint !== null &&
                (insights.slowestEndpoint.averageLatencyMs ?? 0) >= 400
                  ? "warning"
                  : "default"
              }
            />

            <InsightCard
              question="Largest payload"
              answer={
                insights.largestPayload === null ? (
                  "—"
                ) : (
                  formatInsightBytes(insights.largestPayload.totalBytes)
                )
              }
              detail={
                insights.largestPayload === null ? (
                  "No body bytes recorded"
                ) : (
                  <span className="font-mono text-xs text-warm-granite">
                    {insights.largestPayload.method} {truncatePath(insights.largestPayload.path)} ·
                    req {formatInsightBytes(insights.largestPayload.requestBytes)} · res{" "}
                    {formatInsightBytes(insights.largestPayload.responseBytes)}
                  </span>
                )
              }
              href={
                insights.largestPayload === null
                  ? undefined
                  : `/requests/${encodeURIComponent(insights.largestPayload.id)}`
              }
            />

            <InsightCard
              question="Highest error rate"
              answer={
                insights.highestErrorRate === null
                  ? "—"
                  : `${(insights.highestErrorRate.errorRate * 100).toFixed(
                      insights.highestErrorRate.errorRate > 0 &&
                        insights.highestErrorRate.errorRate < 0.01
                        ? 2
                        : 1,
                    )}%`
              }
              detail={
                insights.highestErrorRate === null ? (
                  "No error signal yet"
                ) : insights.highestErrorRate.scope === "tunnel" ? (
                  <span className="font-mono text-xs text-warm-granite">
                    Tunnel {truncateId(insights.highestErrorRate.label)} ·{" "}
                    {String(insights.highestErrorRate.totalRequests)} requests
                  </span>
                ) : (
                  `Across ${String(insights.highestErrorRate.totalRequests)} retained exchanges`
                )
              }
              tone={
                insights.highestErrorRate !== null && insights.highestErrorRate.errorRate >= 0.05
                  ? "warning"
                  : insights.highestErrorRate !== null && insights.highestErrorRate.errorRate === 0
                    ? "positive"
                    : "default"
              }
            />

            <InsightCard
              question="Traffic trend"
              answer={insights.trafficTrend.label}
              detail={insights.trafficTrend.detail}
              tone={
                insights.trafficTrend.direction === "up"
                  ? "positive"
                  : insights.trafficTrend.direction === "down"
                    ? "warning"
                    : "muted"
              }
            />

            <InsightCard
              question="Top tunnels"
              answer={
                insights.topTunnels.length === 0 ? (
                  "—"
                ) : (
                  <span className="font-mono text-lg sm:text-xl">
                    {truncateId(insights.topTunnels[0]!.tunnelId)}
                  </span>
                )
              }
              detail={
                insights.topTunnels.length === 0 ? (
                  "No tunnel aggregates yet"
                ) : (
                  <ul className="space-y-1">
                    {insights.topTunnels.slice(0, 3).map((tunnel, index) => (
                      <li
                        key={tunnel.tunnelId}
                        className="flex items-baseline justify-between gap-2 font-mono text-xs text-warm-granite"
                      >
                        <span className="truncate">
                          {index + 1}. {truncateId(tunnel.tunnelId)}
                        </span>
                        <span className="shrink-0 tabular-nums">
                          {tunnel.totalRequests}
                        </span>
                      </li>
                    ))}
                  </ul>
                )
              }
            />
          </div>
        )}
      </section>

      <section className="space-y-4" aria-label="Snapshot">
        <div>
          <p className="text-caption text-pale-stone">Snapshot</p>
          <h2 className="mt-1.5 text-xl tracking-tight text-bone">Current window</h2>
        </div>
        <MetricBand>
          <StatKpi
            label="Requests / min"
            value={formatNumber(stats.requestsPerMinute)}
            hint="Rolling 60-second window"
            className="border-b border-r border-ash-stroke"
          />
          <StatKpi
            label="Average latency"
            value={formatLatency(stats.averageLatencyMs)}
            hint="Across completed exchanges"
            className="border-b border-ash-stroke sm:border-r xl:border-r"
          />
          <StatKpi
            label="P95 latency"
            value={formatLatency(stats.p95LatencyMs)}
            hint="95th percentile"
            className="border-b border-r border-ash-stroke sm:border-r-0 xl:border-r"
          />
          <StatKpi
            label="Errors"
            value={errorPercent}
            hint={`${String(errorCount)} of ${String(stats.totalRequests)} (4xx/5xx or failed)`}
            className="border-b border-ash-stroke"
          />
        </MetricBand>
      </section>

      <section className="space-y-4" aria-label="Supporting charts">
        <div>
          <p className="text-caption text-pale-stone">Supporting charts</p>
          <h2 className="mt-1.5 text-xl tracking-tight text-bone">Visual context</h2>
          <p className="mt-1 text-sm text-warm-granite">
            Charts back the insights above — not the other way around.
          </p>
        </div>

        {requestsError ? (
          <Alert>
            <AlertTitle>Time-series charts unavailable</AlertTitle>
            <AlertDescription className="font-mono text-xs">
              {formatError(requestsErr)}
            </AlertDescription>
          </Alert>
        ) : null}

        <div className="grid gap-4 lg:grid-cols-2">
          <RequestsOverTimeChart series={series} />
          <LatencyOverTimeChart series={series} />
          <StatusDistributionChart counts={stats.statusCodeCounts} />
          <MethodsChart counts={stats.methodCounts} />
          <TunnelActivityChart series={series} tunnels={stats.tunnels} />
        </div>
      </section>
    </motion.div>
  );
}

function truncateId(id: string): string {
  if (id.length <= 16) {
    return id;
  }
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}

function formatLatency(value: number | undefined): string {
  if (value === undefined) {
    return "—";
  }
  if (value < 1_000) {
    return `${Math.round(value)} ms`;
  }
  return `${(value / 1_000).toFixed(2)} s`;
}

function formatNumber(value: number): string {
  if (!Number.isFinite(value)) {
    return "—";
  }
  if (Number.isInteger(value)) {
    return String(value);
  }
  return value.toFixed(1);
}

function formatError(error: unknown): string {
  if (error instanceof ApiError) {
    return `${error.message}${typeof error.body === "string" ? ` — ${error.body}` : ""}`;
  }
  if (error instanceof NetworkError) {
    return `${error.message}. Is the Badger server running on the configured API URL?`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Failed to load statistics";
}
