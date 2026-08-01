import { create } from "zustand";

export interface LiveTunnel {
  readonly tunnelId: string;
  readonly publicUrl: string;
  readonly port: number;
  readonly workspaceId: string | undefined;
  readonly connectedAt: number;
  readonly restored: boolean;
}

interface TunnelState {
  readonly tunnels: Readonly<Record<string, LiveTunnel>>;
  upsertConnected: (tunnel: LiveTunnel) => void;
  markDisconnected: (tunnelId: string) => void;
  clearWorkspace: (workspaceId: string | undefined) => void;
  reset: () => void;
}

/**
 * Live tunnel sessions observed via DashboardGateway WebSocket events.
 * Client-side only — no API changes.
 */
export const useTunnelStore = create<TunnelState>((set) => ({
  tunnels: {},
  upsertConnected: (tunnel) =>
    set((state) => ({
      tunnels: {
        ...state.tunnels,
        [tunnel.tunnelId]: tunnel,
      },
    })),
  markDisconnected: (tunnelId) =>
    set((state) => {
      if (!(tunnelId in state.tunnels)) {
        return state;
      }
      const { [tunnelId]: _removed, ...rest } = state.tunnels;
      return { tunnels: rest };
    }),
  clearWorkspace: (workspaceId) =>
    set((state) => {
      if (workspaceId === undefined) {
        return { tunnels: {} };
      }
      const scoped: Record<string, LiveTunnel> = {};
      for (const [id, tunnel] of Object.entries(state.tunnels)) {
        if (tunnel.workspaceId === workspaceId) {
          scoped[id] = tunnel;
        }
      }
      return { tunnels: scoped };
    }),
  reset: () => set({ tunnels: {} }),
}));

/**
 * Active tunnels for a workspace, newest first.
 */
export function selectWorkspaceTunnels(
  tunnels: Readonly<Record<string, LiveTunnel>>,
  workspaceId: string | undefined,
): readonly LiveTunnel[] {
  return Object.values(tunnels)
    .filter((tunnel) => workspaceId === undefined || tunnel.workspaceId === workspaceId)
    .sort((a, b) => b.connectedAt - a.connectedAt);
}
