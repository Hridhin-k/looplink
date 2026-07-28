"use client";

import type { CSSProperties } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartPanel } from "@/components/statistics/chart-panel";
import type { StatusCodeCount } from "@/lib/api";

/**
 * Status-code distribution bar chart from aggregate histograms.
 */
export function StatusDistributionChart({
  counts,
}: {
  readonly counts: readonly StatusCodeCount[];
}) {
  const data = counts.map((entry) => ({
    label: String(entry.statusCode),
    count: entry.count,
    statusCode: entry.statusCode,
  }));

  return (
    <ChartPanel
      title="Status code distribution"
      description="Across retained traffic"
      empty={data.length === 0}
    >
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <YAxis
              allowDecimals={false}
              width={32}
              tickLine={false}
              axisLine={false}
              tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
            />
            <Tooltip
              contentStyle={tooltipStyle}
              labelStyle={{ color: "var(--foreground)" }}
              formatter={(value) => [String(value ?? 0), "Count"]}
            />
            <Bar dataKey="count" radius={[6, 6, 0, 0]} isAnimationActive animationDuration={500}>
              {data.map((entry) => (
                <Cell key={entry.label} fill={statusFill(entry.statusCode)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </ChartPanel>
  );
}

function statusFill(statusCode: number): string {
  const classCode = Math.floor(statusCode / 100);
  if (classCode === 2) {
    return "oklch(0.62 0.14 150)";
  }
  if (classCode === 3) {
    return "oklch(0.72 0.12 85)";
  }
  if (classCode === 4) {
    return "oklch(0.68 0.15 45)";
  }
  if (classCode === 5) {
    return "oklch(0.62 0.18 25)";
  }
  return "var(--chart-2)";
}

const tooltipStyle: CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
};
