"use client";

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

import {
  ChartPanel,
  chartGridStroke,
  chartTickStyle,
  chartTooltipStyle,
} from "@/components/statistics/chart-panel";
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
    classLabel: `${String(Math.floor(entry.statusCode / 100))}xx`,
  }));

  return (
    <ChartPanel
      title="Status mix"
      description="Supporting view · retained status codes"
      empty={data.length === 0}
    >
      <div className="h-52 w-full sm:h-60">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke={chartGridStroke} strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
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
              formatter={(value, _name, item) => {
                const payload = item?.payload as { classLabel?: string } | undefined;
                return [String(value ?? 0), payload?.classLabel ?? "Count"];
              }}
            />
            <Bar dataKey="count" name="Count" radius={[3, 3, 0, 0]} isAnimationActive animationDuration={500}>
              {data.map((entry) => (
                <Cell key={entry.label} fill={statusFill(entry.statusCode)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <ul className="mt-3 flex flex-wrap gap-3 text-[11px] text-warm-granite">
        <li className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-[2px] bg-metric-green" aria-hidden />
          2xx
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-[2px] bg-pale-stone" aria-hidden />
          3xx
        </li>
        <li className="inline-flex items-center gap-1.5">
          <span className="size-2 rounded-[2px] bg-signal-orange" aria-hidden />
          4xx / 5xx
        </li>
      </ul>
    </ChartPanel>
  );
}

function statusFill(statusCode: number): string {
  const classCode = Math.floor(statusCode / 100);
  if (classCode === 2) {
    return "#a0ca92";
  }
  if (classCode === 3) {
    return "#b8b3b0";
  }
  if (classCode === 4 || classCode === 5) {
    return "#ee6018";
  }
  return "#8a8380";
}
