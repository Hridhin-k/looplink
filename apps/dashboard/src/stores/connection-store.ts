import { create } from "zustand";

export type DashboardConnectionStatus =
  "idle" | "connecting" | "connected" | "disconnected" | "reconnecting";

interface ConnectionState {
  readonly status: DashboardConnectionStatus;
  readonly lastMessageAt: number | null;
  readonly lastError: string | null;
  readonly reconnectAttempt: number;
  readonly everConnected: boolean;
  /** Provider-bound reconnect trigger (no-op until socket provider mounts). */
  readonly requestReconnect: () => void;
  setStatus: (status: DashboardConnectionStatus) => void;
  markMessage: (at?: number) => void;
  setError: (message: string | null) => void;
  bumpReconnectAttempt: () => void;
  markEverConnected: () => void;
  setRequestReconnect: (fn: () => void) => void;
  reset: () => void;
}

const initial = {
  status: "idle" as const,
  lastMessageAt: null,
  lastError: null,
  reconnectAttempt: 0,
  everConnected: false,
};

/**
 * Live WebSocket connection status for the dashboard shell.
 */
export const useConnectionStore = create<ConnectionState>((set) => ({
  ...initial,
  requestReconnect: () => undefined,
  setStatus: (status) => set({ status }),
  markMessage: (at = Date.now()) => set({ lastMessageAt: at }),
  setError: (lastError) => set({ lastError }),
  bumpReconnectAttempt: () => set((state) => ({ reconnectAttempt: state.reconnectAttempt + 1 })),
  markEverConnected: () => set({ everConnected: true, reconnectAttempt: 0, lastError: null }),
  setRequestReconnect: (requestReconnect) => set({ requestReconnect }),
  reset: () =>
    set({
      ...initial,
      requestReconnect: () => undefined,
    }),
}));
