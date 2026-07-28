"use client";

import { useConnectionStore, type DashboardConnectionStatus } from "@/stores/connection-store";
import { cn } from "@/lib/utils";

const statusLabel: Record<DashboardConnectionStatus, string> = {
  idle: "Idle",
  connecting: "Connecting",
  connected: "Live",
  disconnected: "Disconnected",
  reconnecting: "Reconnecting",
};

/**
 * Compact live WebSocket connection pill for the top nav.
 */
export function ConnectionIndicator({ className }: { readonly className?: string }) {
  const status = useConnectionStore((s) => s.status);

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-md border border-border/80 bg-background/60 px-2.5 py-1 text-xs text-muted-foreground",
        className,
      )}
      title={`WebSocket: ${statusLabel[status]}`}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          status === "connected" && "bg-emerald-500",
          (status === "connecting" || status === "reconnecting") && "animate-pulse bg-amber-500",
          (status === "idle" || status === "disconnected") && "bg-muted-foreground/40",
        )}
        aria-hidden
      />
      <span className="font-mono tracking-tight">{statusLabel[status]}</span>
    </div>
  );
}
