"use client";

import { motion } from "framer-motion";
import { useMemo } from "react";

import { LatencyOverTimeChart } from "@/components/statistics/latency-over-time-chart";
import { MethodsChart } from "@/components/statistics/methods-chart";
import { RequestsOverTimeChart } from "@/components/statistics/requests-over-time-chart";
import { StatKpi } from "@/components/statistics/stat-kpi";
import { StatusDistributionChart } from "@/components/statistics/status-distribution-chart";
import { TunnelActivityChart } from "@/components/statistics/tunnel-activity-chart";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { useInspectorRequests } from "@/hooks/use-inspector-requests";
import { useInspectorStatistics } from "@/hooks/use-inspector-statistics";
import { ApiError, NetworkError } from "@/lib/api";
import { buildStatsTimeSeries } from "@/lib/statistics/time-series";
import { useConnectionStore } from "@/stores/connection-store";

/**
 * Statistics dashboard — aggregate KPIs plus Recharts visualizations.
 *
 * Aggregates come from `GET /api/v1/inspector/statistics`. Time-series charts
 * are derived client-side from retained request summaries.
 */
export function StatisticsView() {
  const liveStatus = useConnectionStore((s) => s.status);

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

  const series = useMemo(() => buildStatsTimeSeries(requests?.items ?? []), [requests?.items]);

  if (statsPending && requestsPending) {
    return (
      <div className="space-y-4">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-24 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
  }

  if (statsError) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load statistics</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          <p className="font-mono text-xs">{formatError(statsErr)}</p>
          <button
            type="button"
            className="w-fit text-sm underline underline-offset-4"
            onClick={() => {
              void refetchStats();
              void refetchRequests();
            }}
          >
            Retry
          </button>
        </AlertDescription>
      </Alert>
    );
  }

  if (stats === undefined) {
    return null;
  }

  const errorCount = Math.round(stats.errorRate * stats.totalRequests);
  const errorPercent = `${(stats.errorRate * 100).toFixed(stats.errorRate > 0 && stats.errorRate < 0.01 ? 2 : 1)}%`;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {stats.totalRequests} retained {stats.totalRequests === 1 ? "exchange" : "exchanges"}
            {liveStatus === "connected" ? " · live" : null}
            {statsFetching ? " · refreshing…" : null}
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatKpi
          label="Requests / min"
          value={formatNumber(stats.requestsPerMinute)}
          hint="Rolling 60-second window"
        />
        <StatKpi
          label="Average latency"
          value={formatLatency(stats.averageLatencyMs)}
          hint="Across completed exchanges"
        />
        <StatKpi
          label="P95 latency"
          value={formatLatency(stats.p95LatencyMs)}
          hint="95th percentile"
        />
        <StatKpi
          label="Errors"
          value={errorPercent}
          hint={`${errorCount} of ${stats.totalRequests} (4xx/5xx or failed)`}
        />
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
    </motion.div>
  );
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
