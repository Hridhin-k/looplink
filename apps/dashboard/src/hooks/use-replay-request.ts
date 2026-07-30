import { useMutation, useQueryClient } from "@tanstack/react-query";

import { useAuth } from "@/components/providers/auth-provider";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { inspectorApi } from "@/lib/api";
import type { InspectorReplayResponse } from "@/lib/api";

/**
 * Replays a recorded request via `POST /api/v1/inspector/replay/:id`.
 */
export function useReplayRequest() {
  const queryClient = useQueryClient();
  const { getAccessToken } = useAuth();
  const { activeWorkspace } = useWorkspace();

  return useMutation({
    mutationFn: async (requestId: string): Promise<InspectorReplayResponse> => {
      const accessToken = await getAccessToken();
      if (accessToken === null) {
        throw new Error("Not authenticated");
      }
      return inspectorApi.replayRequest(requestId, accessToken, activeWorkspace?.id);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["inspector"] });
    },
  });
}
