"use client";

import { RefreshCwIcon, WifiOffIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useConnectionStore } from "@/stores/connection-store";
import { cn } from "@/lib/utils";

/**
 * Graceful disconnect / reconnect banner shown under the top nav.
 */
export function ConnectionBanner() {
  const status = useConnectionStore((s) => s.status);
  const lastError = useConnectionStore((s) => s.lastError);
  const reconnectAttempt = useConnectionStore((s) => s.reconnectAttempt);
  const everConnected = useConnectionStore((s) => s.everConnected);
  const requestReconnect = useConnectionStore((s) => s.requestReconnect);

  const visible =
    everConnected &&
    (status === "disconnected" || status === "reconnecting" || status === "connecting");

  if (!visible) {
    return null;
  }

  const isReconnecting = status === "reconnecting" || status === "connecting";

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        "flex items-center justify-between gap-3 border-b px-3 py-2 text-sm sm:px-4 md:px-6",
        isReconnecting
          ? "border-amber-500/20 bg-amber-500/10 text-amber-950 dark:text-amber-100"
          : "border-border bg-muted/60 text-foreground",
      )}
    >
      <div className="flex min-w-0 items-center gap-2">
        {isReconnecting ? (
          <RefreshCwIcon className="size-3.5 shrink-0 animate-spin" aria-hidden />
        ) : (
          <WifiOffIcon className="size-3.5 shrink-0" aria-hidden />
        )}
        <p className="truncate text-xs sm:text-sm">
          {lastError ??
            (isReconnecting ? "Reconnecting to live traffic…" : "Live connection unavailable.")}
          {reconnectAttempt > 0 ? (
            <span className="ml-1 text-muted-foreground">(attempt {String(reconnectAttempt)})</span>
          ) : null}
        </p>
      </div>

      <Button type="button" variant="outline" size="xs" onClick={requestReconnect}>
        <RefreshCwIcon className="size-3" />
        Reconnect
      </Button>
    </div>
  );
}
