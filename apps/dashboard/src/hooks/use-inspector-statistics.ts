import { useQuery } from "@tanstack/react-query";

import { inspectorApi } from "@/lib/api";
import { useWorkspace } from "@/components/providers/workspace-provider";

export const INSPECTOR_STATISTICS_QUERY_KEY = ["inspector", "statistics"] as const;

/**
 * Loads aggregate traffic statistics from the inspector API.
 *
 * Invalidated live via DashboardGateway `statistics_updated`.
 */
export function useInspectorStatistics(options?: { readonly tunnelId?: string }) {
  const tunnelId = options?.tunnelId;
  const { activeWorkspace } = useWorkspace();

  return useQuery({
    queryKey: [...INSPECTOR_STATISTICS_QUERY_KEY, { workspaceId: activeWorkspace?.id ?? null, tunnelId: tunnelId ?? null }],
    queryFn: () =>
      inspectorApi.getStatistics(
        {
          ...(tunnelId === undefined || tunnelId.length === 0 ? {} : { tunnelId }),
          ...(activeWorkspace?.id ? { workspaceId: activeWorkspace.id } : {}),
        },
      ),
  });
}
