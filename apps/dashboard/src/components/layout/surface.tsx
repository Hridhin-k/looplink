import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface SurfaceProps {
  readonly children: ReactNode;
  readonly className?: string;
}

/**
 * Instrument panel — ink surface with Lumen hairline elevation.
 */
export function Panel({ children, className }: SurfaceProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg bg-ink shadow-hairline transition-machine",
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
        "overflow-hidden rounded-lg shadow-hairline",
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
        "overflow-hidden rounded-lg bg-transparent shadow-hairline",
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
        "inline-flex items-center gap-2 text-caption text-ash",
        className,
      )}
    >
      <span
        className={cn(
          "size-1.5 rounded-full",
          live ? "animate-mc-live bg-success-green" : "bg-smoke",
        )}
        aria-hidden
      />
      {live ? liveLabel : idleLabel}
    </div>
  );
}
