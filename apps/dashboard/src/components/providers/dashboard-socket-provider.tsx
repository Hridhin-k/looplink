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

const RECONNECT_DELAY_MS = 5_000;

/**
 * Connects to DashboardGateway (`/dashboard/ws`) for the authenticated session.
 *
 * Workspace scope is Membership-resolved server-side from the access token +
 * active workspace preference — never trusted from the client alone.
 *
 * Reconnects with a freshly resolved access token so revoked sessions do not
 * spin forever on a stale Bearer query param.
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
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const store = useConnectionStore.getState();
    store.setStatus("connecting");
    store.setError(null);

    const clearReconnectTimer = (): void => {
      if (reconnectTimer !== undefined) {
        clearTimeout(reconnectTimer);
        reconnectTimer = undefined;
      }
    };

    const teardownClient = (): void => {
      unsubscribe?.();
      unsubscribe = undefined;
      client?.disconnect();
      client = undefined;
    };

    const attachClient = (
      next: ReturnType<typeof createDashboardSocketClient>,
    ): void => {
      client = next;
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
    };

    const connect = async (forceRefresh = false): Promise<void> => {
      if (cancelled || intentionalShutdown) {
        return;
      }

      teardownClient();
      useConnectionStore.getState().setStatus("connecting");
      useConnectionStore.getState().setError(null);

      try {
        const token = await getAccessToken(forceRefresh ? { forceRefresh: true } : undefined);
        if (cancelled || intentionalShutdown) {
          return;
        }
        if (token === null) {
          useConnectionStore.getState().setStatus("idle");
          useConnectionStore.getState().setError("Session expired. Sign in again.");
          return;
        }

        attachClient(
          createDashboardSocketClient({
            accessToken: token,
            workspaceId: activeWorkspace?.id,
            autoReconnect: false,
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
              if (intentionalShutdown || intentional || cancelled) {
                return;
              }
              useConnectionStore.getState().setStatus("disconnected");
              useConnectionStore.getState().setError("Live connection lost. Reconnecting…");
              useConnectionStore.getState().bumpReconnectAttempt();
              clearReconnectTimer();
              reconnectTimer = setTimeout(() => {
                reconnectTimer = undefined;
                void connect(true);
              }, RECONNECT_DELAY_MS);
            },
          }),
        );
      } catch (error: unknown) {
        if (cancelled || intentionalShutdown) {
          return;
        }
        const message =
          error instanceof Error && error.message.length > 0
            ? error.message
            : "Could not reach the Badger server.";
        useConnectionStore.getState().setStatus("disconnected");
        useConnectionStore.getState().setError(message);
        useConnectionStore.getState().bumpReconnectAttempt();
        clearReconnectTimer();
        reconnectTimer = setTimeout(() => {
          reconnectTimer = undefined;
          void connect(true);
        }, RECONNECT_DELAY_MS);
      }
    };

    const reconnectNow = (): void => {
      clearReconnectTimer();
      useConnectionStore.getState().setStatus("connecting");
      useConnectionStore.getState().setError(null);
      void connect(true);
    };

    useConnectionStore.getState().setRequestReconnect(reconnectNow);
    void connect(false);

    const onOffline = (): void => {
      useConnectionStore.getState().setStatus("disconnected");
      useConnectionStore.getState().setError("You are offline. Waiting for network…");
    };

    const onOnline = (): void => {
      reconnectNow();
    };

    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);

    return () => {
      cancelled = true;
      intentionalShutdown = true;
      clearReconnectTimer();
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      teardownClient();
      useConnectionStore.getState().setRequestReconnect(() => undefined);
      useConnectionStore.getState().setStatus("idle");
      useConnectionStore.getState().setError(null);
    };
  }, [session, activeWorkspace?.id, getAccessToken, queryClient]);

  return children;
}
