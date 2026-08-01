"use client";

import type { CSSProperties, ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Shared Recharts tooltip chrome for Factory statistics charts.
 */
export const chartTooltipStyle: CSSProperties = {
  background: "#1d1a18",
  border: "1px solid #3d3a39",
  borderRadius: 3,
  fontSize: 12,
  color: "#eeeeee",
  boxShadow: "0 0 0 1px #3d3a39",
};

export const chartTickStyle = {
  fill: "#8a8380",
  fontSize: 11,
} as const;

export const chartGridStroke = "#3d3a39";

/**
 * Chart / distribution panel shell with optional insight eyebrow.
 */
export function ChartPanel({
  title,
  description,
  children,
  className,
  empty,
  footer,
}: {
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly empty?: boolean;
  readonly footer?: ReactNode;
}) {
  return (
    <div
      className={cn(
        "flex min-w-0 flex-col overflow-hidden rounded-[10px] border border-ash-stroke bg-carbon-lift shadow-panel transition-machine",
        className,
      )}
    >
      <div className="space-y-1 border-b border-ash-stroke px-5 py-4">
        <p className="text-caption text-pale-stone">{title}</p>
        {description !== undefined ? (
          <p className="text-sm leading-normal text-warm-granite">{description}</p>
        ) : null}
      </div>
      <div className="p-4 sm:p-5">
        {empty ? (
          <div className="flex h-52 items-center justify-center rounded-[3px] border border-dashed border-ash-stroke sm:h-56">
            <p className="text-sm text-warm-granite">No data in this window yet</p>
          </div>
        ) : (
          children
        )}
        {footer !== undefined && !empty ? <div className="mt-4">{footer}</div> : null}
      </div>
    </div>
  );
}
