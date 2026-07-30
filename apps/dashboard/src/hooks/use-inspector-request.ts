import { useQuery } from "@tanstack/react-query";

import { useAuth } from "@/components/providers/auth-provider";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { inspectorApi } from "@/lib/api";

export const INSPECTOR_REQUEST_QUERY_KEY = ["inspector", "request"] as const;

/**
 * Loads a single recorded exchange from the inspector API.
 */
export function useInspectorRequest(id: string | undefined) {
  const { session, getAccessToken } = useAuth();
  const { activeWorkspace } = useWorkspace();

  return useQuery({
    queryKey: [...INSPECTOR_REQUEST_QUERY_KEY, activeWorkspace?.id ?? null, id ?? null],
    enabled: session !== null && id !== undefined && id.length > 0,
    queryFn: async () => {
      const accessToken = await getAccessToken();
      if (accessToken === null) {
        throw new Error("Not authenticated");
      }
      return inspectorApi.getRequest(id!, accessToken, activeWorkspace?.id);
    },
  });
}
