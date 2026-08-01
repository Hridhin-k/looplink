import { cn } from "@/lib/utils";

interface LatencyBarProps {
  readonly latencyMs: number | undefined;
  /** Upper bound used to normalize the bar (defaults to 1000ms). */
  readonly maxMs?: number;
  readonly className?: string;
}

/**
 * Compact latency meter for explorer cards.
 */
export function LatencyBar({ latencyMs, maxMs = 1_000, className }: LatencyBarProps) {
  if (latencyMs === undefined) {
    return (
      <div className={cn("flex h-1.5 w-full items-center", className)} aria-hidden>
        <div className="h-px w-full bg-ash-stroke" />
      </div>
    );
  }

  const ratio = Math.min(1, Math.max(0.04, latencyMs / Math.max(maxMs, 1)));
  const tone =
    latencyMs < 100
      ? "bg-metric-green"
      : latencyMs < 400
        ? "bg-pale-stone"
        : latencyMs < 1_000
          ? "bg-signal-orange/80"
          : "bg-signal-orange";

  return (
    <div
      className={cn("h-1.5 w-full overflow-hidden rounded-full bg-obsidian-canvas", className)}
      role="meter"
      aria-label={`Latency ${String(latencyMs)} milliseconds`}
      aria-valuemin={0}
      aria-valuemax={maxMs}
      aria-valuenow={latencyMs}
    >
      <div
        className={cn("h-full rounded-full transition-[width] duration-200 ease-[cubic-bezier(0.4,0,0.2,1)]", tone)}
        style={{ width: `${String(ratio * 100)}%` }}
      />
    </div>
  );
}
