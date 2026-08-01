import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/components/providers/auth-provider";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { inspectorApi } from "@/lib/api";
import { withAccessToken } from "@/lib/auth/with-access-token";

export const INSPECTOR_REQUESTS_QUERY_KEY = ["inspector", "requests"] as const;

const DEFAULT_LIMIT = 1_000;

/**
 * Loads recorded traffic summaries from the inspector API.
 *
 * Pass `q` for server-side full-text search across URL, headers, method, body,
 * response, tunnel, status, and timestamp.
 */
export function useInspectorRequests(options?: {
  readonly tunnelId?: string;
  readonly limit?: number;
  readonly q?: string;
}) {
  const tunnelId = options?.tunnelId;
  const limit = options?.limit ?? DEFAULT_LIMIT;
  const q = options?.q?.trim() ?? "";
  const { session, getAccessToken } = useAuth();
  const { activeWorkspace } = useWorkspace();

  return useQuery({
    queryKey: [
      ...INSPECTOR_REQUESTS_QUERY_KEY,
      {
        workspaceId: activeWorkspace?.id ?? null,
        tunnelId: tunnelId ?? null,
        limit,
        q: q.length > 0 ? q : null,
      },
    ],
    enabled: session !== null,
    queryFn: () =>
      withAccessToken(getAccessToken, (accessToken) =>
        inspectorApi.listRequests({
          accessToken,
          limit,
          ...(tunnelId === undefined || tunnelId.length === 0 ? {} : { tunnelId }),
          ...(q.length > 0 ? { q } : {}),
          ...(activeWorkspace?.id ? { workspaceId: activeWorkspace.id } : {}),
        }),
      ),
  });
}
