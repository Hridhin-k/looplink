"use client";

import { useMemo } from "react";

import { ActivityEmptyState } from "@/components/overview/activity-empty-state";
import { LiveActivityFeed } from "@/components/overview/live-activity-feed";
import { TunnelStatusCard } from "@/components/overview/tunnel-status-card";
import { LiveMeta } from "@/components/layout/surface";
import { PageHeader } from "@/components/layout/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useInspectorRequests } from "@/hooks/use-inspector-requests";
import { useInspectorStatistics } from "@/hooks/use-inspector-statistics";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { ApiError, NetworkError } from "@/lib/api";
import { useConnectionStore } from "@/stores/connection-store";

const FEED_LIMIT = 24;

/**
 * Live Activity Center — answers “What is happening right now?”
 *
 * Wired to existing inspector REST + DashboardGateway WebSocket events.
 */
export function OverviewDashboard() {
  const { activeWorkspace } = useWorkspace();
  const liveStatus = useConnectionStore((s) => s.status);
  const live = liveStatus === "connected";
  const workspaceName = activeWorkspace?.name ?? "this workspace";

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
  } = useInspectorRequests({ limit: FEED_LIMIT });

  const events = useMemo(() => requests?.items.slice(0, FEED_LIMIT) ?? [], [requests?.items]);

  if (statsPending && requestsPending) {
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Overview"
          title="Live activity"
          description="What is happening right now"
          meta={<LiveMeta live={live} />}
        />
        <Skeleton className="h-36 w-full rounded-[10px]" />
        <div className="space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-28 w-full rounded-[10px]" />
          ))}
        </div>
      </div>
    );
  }

  if (statsError || requestsError) {
    const err = statsError ? statsErr : requestsErr;
    return (
      <div className="space-y-8">
        <PageHeader
          eyebrow="Overview"
          title="Live activity"
          meta={<LiveMeta live={live} />}
        />
        <Alert variant="destructive">
          <AlertTitle>Could not load live activity</AlertTitle>
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

  const hasTraffic = events.length > 0 || (stats?.totalRequests ?? 0) > 0;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Overview"
        title="Live activity"
        description={
          <>
            Real-time traffic for <span className="text-bone">{workspaceName}</span>
          </>
        }
        meta={<LiveMeta live={live} />}
      />

      <TunnelStatusCard stats={stats} />

      {hasTraffic ? (
        <LiveActivityFeed events={events} workspaceName={workspaceName} />
      ) : (
        <ActivityEmptyState workspaceName={workspaceName} />
      )}
    </div>
  );
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
