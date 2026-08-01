"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import {
  ChartPanel,
  chartGridStroke,
  chartTickStyle,
  chartTooltipStyle,
} from "@/components/statistics/chart-panel";
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
      title="Latency trend"
      description="Supporting view · average latency per minute"
      empty={!hasData}
    >
      <div className="h-52 w-full sm:h-60">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              minTickGap={28}
              tick={chartTickStyle}
            />
            <YAxis
              width={44}
              tickLine={false}
              axisLine={false}
              tick={chartTickStyle}
              unit="ms"
            />
            <Tooltip
              contentStyle={chartTooltipStyle}
              labelStyle={{ color: "#b8b3b0" }}
              formatter={(value) =>
                value === null || value === undefined
                  ? ["—", "Avg latency"]
                  : [`${String(value)} ms`, "Avg latency"]
              }
            />
            <Line
              type="monotone"
              dataKey="avgLatencyMs"
              name="Avg latency"
              stroke="#ee6018"
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
