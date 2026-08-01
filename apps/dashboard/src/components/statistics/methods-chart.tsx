"use client";

import {
  Bar,
  BarChart,
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
import type { MethodCount } from "@/lib/api";

/**
 * HTTP method volume bar chart.
 */
export function MethodsChart({ counts }: { readonly counts: readonly MethodCount[] }) {
  const data = counts.map((entry) => ({
    method: entry.method.toUpperCase(),
    count: entry.count,
  }));

  return (
    <ChartPanel
      title="Methods"
      description="Supporting view · volume by HTTP method"
      empty={data.length === 0}
    >
      <div className="h-52 w-full sm:h-60">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 12, left: 4, bottom: 0 }}>
            <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={chartTickStyle}
            />
            <YAxis
              type="category"
              dataKey="method"
              width={60}
              tickLine={false}
              axisLine={false}
              tick={{ ...chartTickStyle, fontFamily: "var(--font-geist-mono), ui-monospace, monospace" }}
            />
            <Tooltip
              contentStyle={chartTooltipStyle}
              labelStyle={{ color: "#b8b3b0" }}
              formatter={(value) => [String(value ?? 0), "Count"]}
            />
            <Bar
              dataKey="count"
              name="Count"
              fill="#eeeeee"
              radius={[0, 3, 3, 0]}
              isAnimationActive
              animationDuration={500}
            />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartPanel>
  );
}
