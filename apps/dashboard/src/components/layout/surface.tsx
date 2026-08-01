import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SurfaceProps {
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * Instrument panel — carbon surface with hairline elevation.
 */
export function Panel({ children, className }: SurfaceProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[10px] border border-ash-stroke bg-carbon-lift shadow-panel transition-machine",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Metric band — flat grid of KPI cells joined by hairline dividers.
 */
export function MetricBand({ children, className }: SurfaceProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[10px] border border-ash-stroke shadow-panel",
        "grid gap-0 sm:grid-cols-2 xl:grid-cols-4",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Bordered list / table frame without fill — figure implied by stroke.
 */
export function Frame({ children, className }: SurfaceProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-[10px] border border-ash-stroke bg-transparent shadow-hairline",
        className,
      )}
    >
      {children}
    </div>
  );
}

/**
 * Live status chip used in page headers and nav.
 */
export function LiveMeta({
  live,
  idleLabel = "Feed idle",
  liveLabel = "Live feed",
  className,
}: {
  readonly live: boolean;
  readonly idleLabel?: string;
  readonly liveLabel?: string;
  readonly className?: string;
}) {
  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 text-caption text-warm-granite",
        className,
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          live ? "animate-mc-live bg-signal-orange" : "bg-graphite-mid",
        )}
        aria-hidden
      />
      {live ? liveLabel : idleLabel}
    </div>
  );
}
