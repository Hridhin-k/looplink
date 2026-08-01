import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/components/providers/auth-provider";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { inspectorApi } from "@/lib/api";
import { withAccessToken } from "@/lib/auth/with-access-token";

export const INSPECTOR_STATISTICS_QUERY_KEY = ["inspector", "statistics"] as const;

/**
 * Loads aggregate traffic statistics from the inspector API.
 *
 * Invalidated live via DashboardGateway `statistics_updated`.
 */
export function useInspectorStatistics(options?: { readonly tunnelId?: string }) {
  const tunnelId = options?.tunnelId;
  const { session, getAccessToken } = useAuth();
  const { activeWorkspace } = useWorkspace();

  return useQuery({
    queryKey: [
      ...INSPECTOR_STATISTICS_QUERY_KEY,
      { workspaceId: activeWorkspace?.id ?? null, tunnelId: tunnelId ?? null },
    ],
    enabled: session !== null,
    queryFn: () =>
      withAccessToken(getAccessToken, (accessToken) =>
        inspectorApi.getStatistics({
          accessToken,
          ...(tunnelId === undefined || tunnelId.length === 0 ? {} : { tunnelId }),
          ...(activeWorkspace?.id ? { workspaceId: activeWorkspace.id } : {}),
        }),
      ),
  });
}
