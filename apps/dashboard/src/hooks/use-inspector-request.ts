import { useQuery } from "@tanstack/react-query";

import { inspectorApi } from "@/lib/api";

export const INSPECTOR_REQUEST_QUERY_KEY = ["inspector", "request"] as const;

/**
 * Loads a single recorded exchange from the inspector API.
 */
export function useInspectorRequest(id: string | undefined) {
  return useQuery({
    queryKey: [...INSPECTOR_REQUEST_QUERY_KEY, id ?? null],
    queryFn: () => inspectorApi.getRequest(id!),
    enabled: id !== undefined && id.length > 0,
  });
}
