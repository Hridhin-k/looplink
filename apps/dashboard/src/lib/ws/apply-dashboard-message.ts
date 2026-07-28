import type { QueryClient } from "@tanstack/react-query";
import {
  DashboardMessageType,
  type DashboardMessage,
  type DashboardRequestReceivedMessage,
  type DashboardResponseCompletedMessage,
} from "@hridhin-k/badger-shared/dashboard";

import { INSPECTOR_REQUEST_QUERY_KEY } from "@/hooks/use-inspector-request";
import { INSPECTOR_REQUESTS_QUERY_KEY } from "@/hooks/use-inspector-requests";
import type { InspectorRequestList, InspectorRequestSummary } from "@/lib/api";

type RequestsQueryParams = {
  readonly tunnelId: string | null;
  readonly limit: number;
  readonly q?: string | null;
};

/**
 * Applies a live DashboardGateway message to the React Query cache.
 *
 * Request/response events update the explorer list immediately; other events
 * invalidate related inspector queries. Active full-text searches are
 * invalidated so match metadata stays accurate.
 */
export function applyDashboardMessage(queryClient: QueryClient, message: DashboardMessage): void {
  switch (message.type) {
    case DashboardMessageType.RequestReceived:
      upsertRequestReceived(queryClient, message);
      return;
    case DashboardMessageType.ResponseCompleted:
      patchResponseCompleted(queryClient, message);
      return;
    case DashboardMessageType.ReplayCompleted:
      void queryClient.invalidateQueries({ queryKey: ["inspector"] });
      return;
    case DashboardMessageType.StatisticsUpdated:
      void queryClient.invalidateQueries({ queryKey: ["inspector", "statistics"] });
      return;
    default:
      return;
  }
}

/**
 * After a reconnect, refetch inspector data to catch events missed while offline.
 */
export function resyncInspectorAfterReconnect(queryClient: QueryClient): void {
  void queryClient.invalidateQueries({ queryKey: ["inspector"] });
}

function upsertRequestReceived(
  queryClient: QueryClient,
  message: DashboardRequestReceivedMessage,
): void {
  const summary = toPendingSummary(message);

  for (const query of matchingRequestListQueries(queryClient, message.tunnelId)) {
    const params = query.queryKey[2] as RequestsQueryParams;
    if (hasActiveSearch(params)) {
      void queryClient.invalidateQueries({ queryKey: query.queryKey });
      continue;
    }

    queryClient.setQueryData<InspectorRequestList>(query.queryKey, (current) => {
      const existing = current?.items ?? [];
      const without = existing.filter((item) => item.id !== summary.id);
      const items = [summary, ...without].slice(0, params.limit);
      return { items, count: items.length };
    });
  }
}

function patchResponseCompleted(
  queryClient: QueryClient,
  message: DashboardResponseCompletedMessage,
): void {
  for (const query of matchingRequestListQueries(queryClient, message.tunnelId)) {
    const params = query.queryKey[2] as RequestsQueryParams;
    if (hasActiveSearch(params)) {
      void queryClient.invalidateQueries({ queryKey: query.queryKey });
      continue;
    }

    queryClient.setQueryData<InspectorRequestList>(query.queryKey, (current) => {
      if (current === undefined) {
        return current;
      }

      const index = current.items.findIndex((item) => item.id === message.requestId);
      if (index === -1) {
        const summary = toCompletedSummary(message);
        const items = [summary, ...current.items].slice(0, params.limit);
        return { items, count: items.length };
      }

      const existing = current.items[index]!;
      const items = [...current.items];
      items[index] = {
        ...existing,
        method: message.method,
        path: message.path,
        tunnelId: message.tunnelId,
        status: message.statusCode,
        latencyMs: message.latencyMs,
      };
      return { items, count: items.length };
    });
  }

  void queryClient.invalidateQueries({
    queryKey: [...INSPECTOR_REQUEST_QUERY_KEY, message.requestId],
  });
}

function matchingRequestListQueries(queryClient: QueryClient, tunnelId: string) {
  return queryClient
    .getQueryCache()
    .findAll({ queryKey: INSPECTOR_REQUESTS_QUERY_KEY })
    .filter((query) => {
      const params = query.queryKey[2] as RequestsQueryParams | undefined;
      if (params === undefined) {
        return true;
      }
      return params.tunnelId === null || params.tunnelId === tunnelId;
    });
}

function hasActiveSearch(params: RequestsQueryParams): boolean {
  return typeof params.q === "string" && params.q.trim().length > 0;
}

function toPendingSummary(message: DashboardRequestReceivedMessage): InspectorRequestSummary {
  return {
    id: message.requestId,
    timestamp: message.occurredAt,
    method: message.method,
    path: message.path,
    tunnelId: message.tunnelId,
    requestBodyByteLength: 0,
    responseBodyByteLength: 0,
  };
}

function toCompletedSummary(message: DashboardResponseCompletedMessage): InspectorRequestSummary {
  return {
    id: message.requestId,
    timestamp: message.occurredAt,
    method: message.method,
    path: message.path,
    tunnelId: message.tunnelId,
    status: message.statusCode,
    latencyMs: message.latencyMs,
    requestBodyByteLength: 0,
    responseBodyByteLength: 0,
  };
}
