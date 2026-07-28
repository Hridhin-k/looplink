import { useMutation, useQueryClient } from "@tanstack/react-query";

import { inspectorApi } from "@/lib/api";
import type { InspectorReplayResponse } from "@/lib/api";

/**
 * Replays a recorded request via `POST /api/v1/inspector/replay/:id`.
 */
export function useReplayRequest() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (requestId: string): Promise<InspectorReplayResponse> =>
      inspectorApi.replayRequest(requestId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["inspector"] });
    },
  });
}
