"use client";

import { DashboardMessageType } from "@hridhin-k/badger-shared/dashboard";
import { useQueryClient } from "@tanstack/react-query";
import { useEffect, type ReactNode } from "react";

import {
  applyDashboardMessage,
  resyncInspectorAfterReconnect,
} from "@/lib/ws/apply-dashboard-message";
import { createDashboardSocketClient } from "@/lib/ws/dashboard-socket";
import { useConnectionStore } from "@/stores/connection-store";

/**
 * Connects to DashboardGateway (`/dashboard/ws`) for the app lifetime.
 *
 * - Applies live traffic to the React Query cache instantly
 * - Auto-reconnects via {@link createDashboardSocketClient}
 * - Surfaces disconnect / reconnect status in the connection store
 */
export function DashboardSocketProvider({ children }: { readonly children: ReactNode }) {
  const queryClient = useQueryClient();

  useEffect(() => {
    const store = useConnectionStore.getState();
    let intentionalShutdown = false;
    let hadConnection = false;

    store.setStatus("connecting");
    store.setError(null);

    const client = createDashboardSocketClient({
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
      // Force a fresh socket: disconnect cancels timers; connect opens immediately.
      // Stale close events are ignored by DashboardLiveClient when a newer socket exists.
      client.disconnect();
      client.connect();
    };

    useConnectionStore.getState().setRequestReconnect(reconnectNow);

    const unsubscribe = client.subscribe((message) => {
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

    const onOffline = (): void => {
      useConnectionStore.getState().setStatus("disconnected");
      useConnectionStore.getState().setError("You are offline. Waiting for network…");
    };

    const onOnline = (): void => {
      useConnectionStore.getState().setStatus("connecting");
      useConnectionStore.getState().setError(null);
      client.connect();
    };

    window.addEventListener("offline", onOffline);
    window.addEventListener("online", onOnline);

    return () => {
      intentionalShutdown = true;
      window.removeEventListener("offline", onOffline);
      window.removeEventListener("online", onOnline);
      unsubscribe();
      client.disconnect();
      useConnectionStore.getState().setRequestReconnect(() => undefined);
      useConnectionStore.getState().setStatus("idle");
      useConnectionStore.getState().setError(null);
    };
  }, [queryClient]);

  return children;
}
