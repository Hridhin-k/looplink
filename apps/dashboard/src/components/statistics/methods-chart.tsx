"use client";

import type { CSSProperties } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { ChartPanel } from "@/components/statistics/chart-panel";
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
      description="Request volume by HTTP method"
      empty={data.length === 0}
    >
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} layout="vertical" margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" horizontal={false} />
            <XAxis
              type="number"
              allowDecimals={false}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <YAxis
              type="category"
              dataKey="method"
              width={56}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={{ color: "var(--foreground)" }}
              formatter={(value) => [String(value ?? 0), "Count"]}
            />
            <Bar
              dataKey="count"
              fill="var(--chart-2)"
              radius={[0, 6, 6, 0]}
              isAnimationActive
              animationDuration={500}
            />
          </BarChart>
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
