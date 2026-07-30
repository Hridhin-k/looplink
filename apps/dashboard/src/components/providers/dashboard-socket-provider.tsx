"use client";

import { DashboardMessageType } from "@hridhin-k/badger-shared/dashboard";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { useWorkspace } from "@/components/providers/workspace-provider";
import {
  applyDashboardMessage,
  resyncInspectorAfterReconnect,
} from "@/lib/ws/apply-dashboard-message";
import { createDashboardSocketClient } from "@/lib/ws/dashboard-socket";
import { useConnectionStore } from "@/stores/connection-store";

/**
 * Connects to DashboardGateway (`/dashboard/ws`) for the authenticated session.
 *
 * Workspace scope is Membership-resolved server-side from the access token +
 * active workspace preference — never trusted from the client alone.
 */
export function DashboardSocketProvider({ children }: { readonly children: ReactNode }) {
  const queryClient = useQueryClient();
  const { session, getAccessToken } = useAuth();
  const { activeWorkspace } = useWorkspace();

  useEffect(() => {
    if (session === null) {
      useConnectionStore.getState().setStatus("idle");
      return;
    }

    let cancelled = false;
    let intentionalShutdown = false;
    let hadConnection = false;
    let client: ReturnType<typeof createDashboardSocketClient> | undefined;
    let unsubscribe: (() => void) | undefined;

    const store = useConnectionStore.getState();
    store.setStatus("connecting");
    store.setError(null);

    void (async () => {
      const token = await getAccessToken();
      if (cancelled || token === null) {
        useConnectionStore.getState().setStatus("idle");
        return;
      }

      client = createDashboardSocketClient({
        accessToken: token,
        workspaceId: activeWorkspace?.id,
        onOpen: () => {
          useConnectionStore.getState().setStatus("connected");
          useConnectionStore.getState().setError(null);
          if (hadConnection) {
            resyncInspectorAfterReconnect(queryClient);
          }
          hadConnection = true;
          useConnectionStore.getState().markEverConnected();
        },
        onClose: ({ intentional }) => {
          if (intentionalShutdown || intentional) {
            return;
          }
          useConnectionStore.getState().setStatus("disconnected");
          useConnectionStore.getState().setError("Live connection lost. Reconnecting…");
        },
        onReconnecting: () => {
          useConnectionStore.getState().bumpReconnectAttempt();
          useConnectionStore.getState().setStatus("reconnecting");
        },
      });

      const reconnectNow = (): void => {
        useConnectionStore.getState().setStatus("connecting");
        useConnectionStore.getState().setError(null);
        client?.disconnect();
        client?.connect();
      };

      useConnectionStore.getState().setRequestReconnect(reconnectNow);

      unsubscribe = client.subscribe((message) => {
        useConnectionStore.getState().markMessage(message.occurredAt);

        if (message.type === DashboardMessageType.Connected) {
          useConnectionStore.getState().setStatus("connected");
          useConnectionStore.getState().markEverConnected();
          return;
        }

        if (message.type === DashboardMessageType.Ping) {
          return;
        }

        applyDashboardMessage(queryClient, message);
      });

      client.connect();
    })();

    const onOffline = (): void => {
      useConnectionStore.getState().setStatus("disconnected");
      useConnectionStore.getState().setError("You are offline. Waiting for network…");
    };

    const onOnline = (): void => {
      useConnectionStore.getState().setStatus("connecting");
      useConnectionStore.getState().setError(null);
      client?.connect();
    };

    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);

    return () => {
      cancelled = true;
      intentionalShutdown = true;
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      unsubscribe?.();
      client?.disconnect();
      useConnectionStore.getState().setRequestReconnect(() => undefined);
      useConnectionStore.getState().setStatus("idle");
      useConnectionStore.getState().setError(null);
    };
  }, [session, activeWorkspace?.id, getAccessToken, queryClient]);

  return children;
}
