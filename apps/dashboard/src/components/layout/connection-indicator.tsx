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
  const isLive = status === "connected";
  const isBusy = status === "connecting" || status === "reconnecting";

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-[3px] border border-ash-stroke bg-carbon-lift px-2.5 py-1.5 text-warm-granite transition-machine",
        isLive && "border-signal-orange/35 text-bone",
        isBusy && "border-signal-orange/20",
        className,
      )}
      title={`WebSocket: ${statusLabel[status]}`}
      aria-live="polite"
      aria-atomic="true"
    >
      <span className="relative flex size-1.5" aria-hidden>
        {isLive ? (
          <span className="absolute inset-0 animate-mc-live rounded-full bg-signal-orange/50" />
        ) : null}
        <span
          className={cn(
            "relative size-1.5 rounded-full",
            isLive && "bg-signal-orange",
            isBusy && "animate-pulse motion-reduce:animate-none bg-signal-orange/70",
            (status === "idle" || status === "disconnected") && "bg-graphite-mid",
          )}
        />
      </span>
      <span className="text-caption">{statusLabel[status]}</span>
    </div>
  );
}
