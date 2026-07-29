import { useQuery } from "@tanstack/react-query";

import { inspectorApi } from "@/lib/api";
import { useWorkspace } from "@/components/providers/workspace-provider";

export const INSPECTOR_REQUEST_QUERY_KEY = ["inspector", "request"] as const;

/**
 * Loads a single recorded exchange from the inspector API.
 */
export function useInspectorRequest(id: string | undefined) {
  const { activeWorkspace } = useWorkspace();

  return useQuery({
    queryKey: [...INSPECTOR_REQUEST_QUERY_KEY, activeWorkspace?.id ?? null, id ?? null],
    queryFn: () => inspectorApi.getRequest(id!, activeWorkspace?.id),
    enabled: id !== undefined && id.length > 0,
  });
}
