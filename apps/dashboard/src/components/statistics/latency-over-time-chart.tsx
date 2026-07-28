"use client";

import type { CSSProperties } from "react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartPanel } from "@/components/statistics/chart-panel";
import type { StatsTimeBucket } from "@/lib/statistics/time-series";

/**
 * Average latency line chart over the recent window.
 */
export function LatencyOverTimeChart({ series }: { readonly series: readonly StatsTimeBucket[] }) {
  const data = series.map((bucket) => ({
    label: bucket.label,
    avgLatencyMs: bucket.avgLatencyMs === null ? null : Math.round(bucket.avgLatencyMs * 10) / 10,
  }));
  const hasData = data.some((point) => point.avgLatencyMs !== null);

  return (
    <ChartPanel
      title="Latency over time"
      description="Average latency per minute (ms)"
      empty={!hasData}
    >
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              minTickGap={28}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <YAxis
              width={40}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
              unit="ms"
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={{ color: "var(--foreground)" }}
              formatter={(value) =>
                value === null || value === undefined
                  ? ["—", "Avg latency"]
                  : [`${String(value)} ms`, "Avg latency"]
              }
            />
            <Line
              type="monotone"
              dataKey="avgLatencyMs"
              stroke="var(--chart-3)"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
              isAnimationActive
              animationDuration={600}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </ChartPanel>
  );
}

const tooltipStyle: CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
};
