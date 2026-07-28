import { useQuery } from "@tanstack/react-query";

import { inspectorApi } from "@/lib/api";

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

  return useQuery({
    queryKey: [
      ...INSPECTOR_REQUESTS_QUERY_KEY,
      { tunnelId: tunnelId ?? null, limit, q: q.length > 0 ? q : null },
    ],
    queryFn: () =>
      inspectorApi.listRequests({
        limit,
        ...(tunnelId === undefined || tunnelId.length === 0 ? {} : { tunnelId }),
        ...(q.length > 0 ? { q } : {}),
      }),
  });
}
