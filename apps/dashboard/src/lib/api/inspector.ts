import { apiClient } from "./client";
import type {
  InspectorRequestDetail,
  InspectorRequestList,
  InspectorReplayResponse,
  InspectorStatistics,
} from "./types";

function scopeHeaders(accessToken: string, workspaceId?: string): HeadersInit {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${accessToken}`,
  };
  if (workspaceId !== undefined && workspaceId.trim().length > 0) {
    headers["x-workspace-id"] = workspaceId.trim();
  }
  return headers;
}

/**
 * REST helpers for `/api/v1/inspector/*`.
 *
 * Workspace-scoped reads require a Bearer token — the server verifies Membership
 * and never trusts `x-workspace-id` alone.
 */
export const inspectorApi = {
  listRequests(params: {
    readonly accessToken: string;
    readonly limit?: number;
    readonly tunnelId?: string;
    readonly q?: string;
    readonly workspaceId?: string;
  }): Promise<InspectorRequestList> {
    const search = new URLSearchParams();
    if (params.limit !== undefined) {
      search.set("limit", String(params.limit));
    }
    if (params.tunnelId !== undefined && params.tunnelId.length > 0) {
      search.set("tunnelId", params.tunnelId);
    }
    if (params.q !== undefined && params.q.trim().length > 0) {
      search.set("q", params.q.trim());
    }
    const query = search.toString();
    return apiClient<InspectorRequestList>(
      `/api/v1/inspector/requests${query.length > 0 ? `?${query}` : ""}`,
      { headers: scopeHeaders(params.accessToken, params.workspaceId) },
    );
  },

  getRequest(
    id: string,
    accessToken: string,
    workspaceId?: string,
  ): Promise<InspectorRequestDetail> {
    return apiClient<InspectorRequestDetail>(
      `/api/v1/inspector/request/${encodeURIComponent(id)}`,
      { headers: scopeHeaders(accessToken, workspaceId) },
    );
  },

  replayRequest(
    id: string,
    accessToken: string,
    workspaceId?: string,
  ): Promise<InspectorReplayResponse> {
    return apiClient<InspectorReplayResponse>(
      `/api/v1/inspector/replay/${encodeURIComponent(id)}`,
      { method: "POST", headers: scopeHeaders(accessToken, workspaceId) },
    );
  },

  getStatistics(params: {
    readonly accessToken: string;
    readonly tunnelId?: string;
    readonly workspaceId?: string;
  }): Promise<InspectorStatistics> {
    const search = new URLSearchParams();
    if (params.tunnelId !== undefined && params.tunnelId.length > 0) {
      search.set("tunnelId", params.tunnelId);
    }
    const query = search.toString();
    return apiClient<InspectorStatistics>(
      `/api/v1/inspector/statistics${query.length > 0 ? `?${query}` : ""}`,
      { headers: scopeHeaders(params.accessToken, params.workspaceId) },
    );
  },
} as const;
