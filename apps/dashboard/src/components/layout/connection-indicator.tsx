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
        "inline-flex items-center gap-2 rounded-[3px] border border-ash-stroke bg-carbon-lift px-2.5 py-1 text-xs text-warm-granite",
        className,
      )}
      title={`WebSocket: ${statusLabel[status]}`}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          status === "connected" && "bg-signal-orange",
          (status === "connecting" || status === "reconnecting") &&
            "animate-pulse bg-signal-orange/70",
          (status === "idle" || status === "disconnected") && "bg-graphite-mid",
        )}
        aria-hidden
      />
      <span className="font-mono text-[12px] tracking-[-0.02em] uppercase">
        {statusLabel[status]}
      </span>
    </div>
  );
}
