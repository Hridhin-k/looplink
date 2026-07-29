import { apiClient } from "./client";
import type {
  InspectorRequestDetail,
  InspectorRequestList,
  InspectorReplayResponse,
  InspectorStatistics,
} from "./types";

/**
 * REST helpers for `/api/v1/inspector/*`.
 * Request list/detail pages are not wired yet — these are ready for them.
 */
export const inspectorApi = {
  listRequests(params?: {
    readonly limit?: number;
    readonly tunnelId?: string;
    readonly q?: string;
    readonly workspaceId?: string;
  }): Promise<InspectorRequestList> {
    const search = new URLSearchParams();
    if (params?.limit !== undefined) {
      search.set("limit", String(params.limit));
    }
    if (params?.tunnelId !== undefined && params.tunnelId.length > 0) {
      search.set("tunnelId", params.tunnelId);
    }
    if (params?.q !== undefined && params.q.trim().length > 0) {
      search.set("q", params.q.trim());
    }
    const query = search.toString();
    return apiClient<InspectorRequestList>(
      `/api/v1/inspector/requests${query.length > 0 ? `?${query}` : ""}`,
      params?.workspaceId ? { headers: { "x-workspace-id": params.workspaceId } } : undefined,
    );
  },

  getRequest(id: string, workspaceId?: string): Promise<InspectorRequestDetail> {
    return apiClient<InspectorRequestDetail>(`/api/v1/inspector/request/${encodeURIComponent(id)}`, workspaceId ? { headers: { "x-workspace-id": workspaceId } } : undefined);
  },

  replayRequest(id: string, workspaceId?: string): Promise<InspectorReplayResponse> {
    return apiClient<InspectorReplayResponse>(
      `/api/v1/inspector/replay/${encodeURIComponent(id)}`,
      workspaceId ? { method: "POST", headers: { "x-workspace-id": workspaceId } } : { method: "POST" },
    );
  },

  getStatistics(params?: { readonly tunnelId?: string; readonly workspaceId?: string }): Promise<InspectorStatistics> {
    const search = new URLSearchParams();
    if (params?.tunnelId !== undefined && params.tunnelId.length > 0) {
      search.set("tunnelId", params.tunnelId);
    }
    const query = search.toString();
    return apiClient<InspectorStatistics>(
      `/api/v1/inspector/statistics${query.length > 0 ? `?${query}` : ""}`,
      params?.workspaceId ? { headers: { "x-workspace-id": params.workspaceId } } : undefined,
    );
  },
} as const;
