"use client";

import {
  Area,
  AreaChart,
  CartesianGrid,
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
 * Requests-per-bucket area chart over the recent window.
 */
export function RequestsOverTimeChart({ series }: { readonly series: readonly StatsTimeBucket[] }) {
  const hasData = series.some((bucket) => bucket.requests > 0);

  return (
    <ChartPanel
      title="Traffic over time"
      description="Supporting view · last 30 minutes · 1-minute buckets"
      empty={!hasData}
    >
      <div className="h-52 w-full sm:h-60">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={[...series]} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="requestsFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#a0ca92" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#a0ca92" stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              minTickGap={28}
              tick={chartTickStyle}
            />
            <YAxis
              allowDecimals={false}
              width={36}
              tickLine={false}
              axisLine={false}
              tick={chartTickStyle}
            />
            <Tooltip
              contentStyle={chartTooltipStyle}
              labelStyle={{ color: "#b8b3b0" }}
              formatter={(value) => [String(value ?? 0), "Requests"]}
            />
            <Area
              type="monotone"
              dataKey="requests"
              name="Requests"
              stroke="#a0ca92"
              fill="url(#requestsFill)"
              strokeWidth={2}
              isAnimationActive
              animationDuration={600}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartPanel>
  );
}
