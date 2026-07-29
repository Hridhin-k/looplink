import { useMutation, useQueryClient } from "@tanstack/react-query";

import { inspectorApi } from "@/lib/api";
import { useWorkspace } from "@/components/providers/workspace-provider";
import type { InspectorReplayResponse } from "@/lib/api";

/**
 * Replays a recorded request via `POST /api/v1/inspector/replay/:id`.
 */
export function useReplayRequest() {
  const queryClient = useQueryClient();
  const { activeWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: (requestId: string): Promise<InspectorReplayResponse> =>
      inspectorApi.replayRequest(requestId, activeWorkspace?.id),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["inspector"] });
    },
  });
}
