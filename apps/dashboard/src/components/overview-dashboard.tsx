"use client";

import { MethodBadge } from "@/components/requests/method-badge";
import { StatusBadge } from "@/components/requests/status-badge";
import { StatKpi } from "@/components/statistics/stat-kpi";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useInspectorRequests } from "@/hooks/use-inspector-requests";
import { useInspectorStatistics } from "@/hooks/use-inspector-statistics";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { ApiError, NetworkError } from "@/lib/api";
import { useConnectionStore } from "@/stores/connection-store";
import Link from "next/link";
import { useMemo } from "react";

/**
 * Overview: live KPIs + recent traffic, wired to existing inspector APIs.
 */
export function OverviewDashboard() {
  const { activeWorkspace } = useWorkspace();
  const liveStatus = useConnectionStore((s) => s.status);

  const {
    data: stats,
    isPending: statsPending,
    isError: statsError,
    error: statsErr,
    refetch: refetchStats,
  } = useInspectorStatistics();

  const {
    data: requests,
    isPending: requestsPending,
    isError: requestsError,
    error: requestsErr,
    refetch: refetchRequests,
  } = useInspectorRequests({ limit: 20 });

  const recent = useMemo(() => requests?.items.slice(0, 8) ?? [], [requests?.items]);

  if (statsPending && requestsPending) {
    return (
      <div className="space-y-6">
        <OverviewHeader workspaceName={activeWorkspace?.name} live={liveStatus === "connected"} />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {Array.from({ length: 4 }, (_, index) => (
            <Skeleton key={index} className="h-24 rounded-[10px] bg-carbon-lift" />
          ))}
        </div>
        <Skeleton className="h-64 w-full rounded-[10px] bg-carbon-lift" />
      </div>
    );
  }

  if (statsError || requestsError) {
    const err = statsError ? statsErr : requestsErr;
    return (
      <div className="space-y-6">
        <OverviewHeader workspaceName={activeWorkspace?.name} live={liveStatus === "connected"} />
        <Alert variant="destructive">
          <AlertTitle>Could not load overview</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <p className="font-mono text-xs">{formatError(err)}</p>
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

  const totalRequests = stats?.totalRequests ?? 0;
  const hasTraffic = totalRequests > 0 || recent.length > 0;

  return (
    <div className="space-y-8">
      <OverviewHeader workspaceName={activeWorkspace?.name} live={liveStatus === "connected"} />

      <div className="grid gap-0 sm:grid-cols-2 xl:grid-cols-4">
        <StatKpi
          label="Requests"
          value={formatCount(totalRequests)}
          hint={`${formatRate(stats?.requestsPerMinute ?? 0)} / min`}
          className="rounded-none border-0 border-b border-r border-ash-stroke bg-transparent shadow-none"
        />
        <StatKpi
          label="Error rate"
          value={`${formatPercent(stats?.errorRate ?? 0)}%`}
          hint="Across retained traffic"
          className="rounded-none border-0 border-b border-r border-ash-stroke bg-transparent shadow-none xl:border-r"
        />
        <StatKpi
          label="Avg latency"
          value={formatLatency(stats?.averageLatencyMs)}
          hint={stats?.p95LatencyMs !== undefined ? `p95 ${formatLatency(stats.p95LatencyMs)}` : undefined}
          className="rounded-none border-0 border-b border-r border-ash-stroke bg-transparent shadow-none sm:border-r-0 xl:border-r"
        />
        <StatKpi
          label="Tunnels"
          value={formatCount(stats?.tunnels.length ?? 0)}
          hint="With recorded traffic"
          className="rounded-none border-0 border-b border-ash-stroke bg-transparent shadow-none"
        />
      </div>

      {!hasTraffic ? (
        <div className="rounded-[10px] border border-ash-stroke p-6">
          <p className="font-mono text-[12px] tracking-[-0.02em] text-pale-stone uppercase">
            Getting started
          </p>
          <h2 className="mt-2 max-w-lg text-[36px] leading-[1.1] tracking-[-1.12px] text-bone">
            Nothing to inspect yet
          </h2>
          <p className="mt-3 max-w-md text-sm text-warm-granite">
            Start a tunnel with the Badger CLI, then traffic for{" "}
            <span className="text-bone">{activeWorkspace?.name ?? "this workspace"}</span> will
            appear here, in Requests, and in Statistics.
          </p>
          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href="/requests"
              className="inline-flex h-8 items-center rounded-[3px] bg-chalk px-3.5 text-sm text-obsidian-canvas"
            >
              Open requests
            </Link>
            <Link
              href="/workspace"
              className="inline-flex h-8 items-center rounded-[3px] border border-ash-stroke px-3.5 text-sm text-bone"
            >
              Workspace settings
            </Link>
          </div>
          <pre className="mt-6 overflow-x-auto rounded-[3px] border border-ash-stroke bg-carbon-lift p-4 font-mono text-xs text-pale-stone">
            {`badger login\nbadger 3000`}
          </pre>
        </div>
      ) : (
        <section className="space-y-4">
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="font-mono text-[12px] tracking-[-0.02em] text-pale-stone uppercase">
                Recent traffic
              </p>
              <h2 className="mt-1 text-xl tracking-tight text-bone">Latest requests</h2>
            </div>
            <div className="flex gap-2">
              <Link
                href="/requests"
                className="inline-flex h-7 items-center rounded-[3px] border border-ash-stroke px-2.5 text-xs text-bone"
              >
                All requests
              </Link>
              <Link
                href="/statistics"
                className="inline-flex h-7 items-center rounded-[3px] border border-ash-stroke px-2.5 text-xs text-bone"
              >
                Statistics
              </Link>
            </div>
          </div>

          <div className="overflow-hidden rounded-[10px] border border-ash-stroke">
            <ul className="divide-y divide-ash-stroke">
              {recent.map((item) => (
                <li key={item.id}>
                  <Link
                    href={`/requests/${encodeURIComponent(item.id)}`}
                    className="flex flex-wrap items-center gap-3 px-4 py-3 transition-colors hover:bg-carbon-lift"
                  >
                    <MethodBadge method={item.method} />
                    <StatusBadge status={item.status} />
                    <span className="min-w-0 flex-1 truncate font-mono text-sm text-bone">
                      {item.path}
                    </span>
                    <span className="font-mono text-[11px] text-warm-granite tabular-nums">
                      {item.latencyMs !== undefined ? `${String(item.latencyMs)}ms` : "—"}
                    </span>
                    <span className="font-mono text-[11px] text-warm-granite">
                      {formatTime(item.timestamp)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}
    </div>
  );
}

function OverviewHeader({
  workspaceName,
  live,
}: {
  readonly workspaceName: string | undefined;
  readonly live: boolean;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div>
        <p className="font-mono text-[12px] tracking-[-0.02em] text-pale-stone uppercase">
          Overview
        </p>
        <h1 className="mt-1 text-[36px] leading-[1.1] tracking-[-1.12px] text-bone">
          {workspaceName ?? "Workspace"}
        </h1>
      </div>
      <div className="inline-flex items-center gap-2 font-mono text-[12px] tracking-[-0.02em] text-warm-granite uppercase">
        <span
          className={`size-1.5 rounded-full ${live ? "bg-signal-orange" : "bg-graphite-mid"}`}
          aria-hidden
        />
        {live ? "Live feed" : "Feed idle"}
      </div>
    </div>
  );
}

function formatCount(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

function formatRate(value: number): string {
  return value.toFixed(value >= 10 ? 0 : 1);
}

function formatPercent(value: number): string {
  return (value * 100).toFixed(value >= 0.1 ? 0 : 1);
}

function formatLatency(ms: number | undefined): string {
  if (ms === undefined) {
    return "—";
  }
  if (ms >= 1000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  return `${Math.round(ms)}ms`;
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatError(error: unknown): string {
  if (error instanceof ApiError) {
    return `API ${String(error.status)} ${error.path}`;
  }
  if (error instanceof NetworkError) {
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unknown error";
}
