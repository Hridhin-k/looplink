"use client";

import { cn } from "@/lib/utils";

/**
 * Compact KPI tile for overview and statistics.
 * Designed for MetricBand grids (hairline dividers, no individual card chrome).
 */
export function StatKpi({
  label,
  value,
  hint,
  className,
}: {
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
  readonly className?: string;
}) {
  return (
    <div
      className={cn(
        "min-w-0 bg-transparent px-5 py-5 transition-machine hover:bg-carbon-lift/50",
        className,
      )}
    >
      <p className="text-caption text-pale-stone">{label}</p>
      <p className="mt-3 text-[32px] leading-[1.1] tracking-[-1.12px] text-bone tabular-nums sm:text-[36px]">
        {value}
      </p>
      {hint !== undefined ? (
        <p className="mt-2 text-xs leading-normal text-warm-granite">{hint}</p>
      ) : null}
    </div>
  );
}
