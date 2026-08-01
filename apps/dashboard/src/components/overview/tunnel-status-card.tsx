"use client";

import { useEffect, useState, type ReactNode } from "react";

import { useWorkspace } from "@/components/providers/workspace-provider";
import type { InspectorStatistics } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useConnectionStore } from "@/stores/connection-store";
import { selectWorkspaceTunnels, useTunnelStore } from "@/stores/tunnel-store";

interface TunnelStatusCardProps {
  readonly stats: InspectorStatistics | undefined;
}

/**
 * Pinned tunnel / connection status for the Live Activity Center.
 */
export function TunnelStatusCard({ stats }: TunnelStatusCardProps) {
  const { activeWorkspace } = useWorkspace();
  const connectionStatus = useConnectionStore((s) => s.status);
  const lastMessageAt = useConnectionStore((s) => s.lastMessageAt);
  const tunnelsMap = useTunnelStore((s) => s.tunnels);

  const liveTunnels = selectWorkspaceTunnels(tunnelsMap, activeWorkspace?.id);
  const primary = liveTunnels[0];
  const statsTunnelCount = stats?.tunnels.length ?? 0;
  const trafficRate = stats?.requestsPerMinute ?? 0;

  const wsLive = connectionStatus === "connected";
  const tunnelUp = liveTunnels.length > 0;
  const hasRecordedTunnels = statsTunnelCount > 0;
  const pulsing =
    wsLive &&
    (trafficRate > 0 ||
      (lastMessageAt !== null && Date.now() - lastMessageAt < 4_000));

  const connectionLabel = wsLive ? "Live" : connectionStatus === "connecting" || connectionStatus === "reconnecting"
    ? "Connecting"
    : "Offline";

  const tunnelLabel = tunnelUp
    ? liveTunnels.length === 1
      ? "Tunnel up"
      : `${String(liveTunnels.length)} tunnels up`
    : hasRecordedTunnels
      ? "No live session"
      : "Waiting for tunnel";

  return (
    <aside
      className={cn(
        "relative overflow-hidden rounded-[10px] border border-ash-stroke bg-carbon-lift shadow-panel",
        pulsing && "border-signal-orange/35",
      )}
      aria-label="Tunnel status"
    >
      <TrafficPulse active={pulsing} />

      <div className="relative grid gap-0 sm:grid-cols-2 lg:grid-cols-4">
        <StatusCell
          label="Connection"
          value={connectionLabel}
          hint={wsLive ? "Dashboard WebSocket" : "Reconnect from the banner"}
          accent={wsLive ? "live" : "idle"}
        />
        <StatusCell
          label="Tunnel"
          value={tunnelLabel}
          hint={
            primary !== undefined
              ? truncateId(primary.tunnelId)
              : hasRecordedTunnels
                ? `${String(statsTunnelCount)} with traffic`
                : "Run badger locally"
          }
          accent={tunnelUp ? "up" : "idle"}
        />
        <StatusCell
          label="Uptime"
          value={
            primary !== undefined ? (
              <UptimeClock connectedAt={primary.connectedAt} />
            ) : (
              "—"
            )
          }
          hint={
            primary?.restored === true
              ? "Restored session"
              : primary !== undefined
                ? `Port ${String(primary.port)}`
                : "Start a local tunnel"
          }
        />
        <StatusCell
          label="Traffic"
          value={`${formatRate(trafficRate)} / min`}
          hint={activeWorkspace?.name ?? "Workspace"}
          accent={trafficRate > 0 ? "traffic" : "idle"}
          className="sm:border-r-0"
        />
      </div>

      {primary?.publicUrl !== undefined ? (
        <div className="relative border-t border-ash-stroke px-5 py-3">
          <p className="text-caption text-pale-stone">Public URL</p>
          <p className="mt-1 truncate font-mono text-xs text-bone">{primary.publicUrl}</p>
        </div>
      ) : null}
    </aside>
  );
}

function StatusCell({
  label,
  value,
  hint,
  accent = "idle",
  className,
}: {
  readonly label: string;
  readonly value: ReactNode;
  readonly hint: string;
  readonly accent?: "live" | "up" | "traffic" | "idle";
  readonly className?: string;
}) {
  return (
    <div
      className={cn(
        "border-b border-r border-ash-stroke px-5 py-5 last:border-r-0 lg:border-b-0",
        className,
      )}
    >
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "size-1.5 rounded-full",
            accent === "live" && "animate-mc-live bg-signal-orange",
            accent === "up" && "bg-metric-green",
            accent === "traffic" && "animate-mc-live bg-metric-green",
            accent === "idle" && "bg-graphite-mid",
          )}
          aria-hidden
        />
        <p className="text-caption text-pale-stone">{label}</p>
      </div>
      <p className="mt-3 text-xl tracking-tight text-bone tabular-nums sm:text-2xl">{value}</p>
      <p className="mt-1.5 truncate text-xs text-warm-granite">{hint}</p>
    </div>
  );
}

function TrafficPulse({ active }: { readonly active: boolean }) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-500",
        active && "opacity-100",
      )}
      aria-hidden
    >
      <div className="absolute inset-y-0 left-0 w-1 bg-signal-orange/80" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_left,rgba(238,96,24,0.08),transparent_55%)]" />
    </div>
  );
}

function UptimeClock({ connectedAt }: { readonly connectedAt: number }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 1_000);
    return () => window.clearInterval(id);
  }, []);

  return <span className="tabular-nums">{formatUptime(Math.max(0, now - connectedAt))}</span>;
}

function formatUptime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1_000);
  const hours = Math.floor(totalSeconds / 3_600);
  const minutes = Math.floor((totalSeconds % 3_600) / 60);
  const seconds = totalSeconds % 60;
  if (hours > 0) {
    return `${String(hours)}h ${String(minutes).padStart(2, "0")}m`;
  }
  if (minutes > 0) {
    return `${String(minutes)}m ${String(seconds).padStart(2, "0")}s`;
  }
  return `${String(seconds)}s`;
}

function formatRate(value: number): string {
  return value.toFixed(value >= 10 ? 0 : 1);
}

function truncateId(id: string): string {
  if (id.length <= 18) {
    return id;
  }
  return `${id.slice(0, 8)}…${id.slice(-6)}`;
}
