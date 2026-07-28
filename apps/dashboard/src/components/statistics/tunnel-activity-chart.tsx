"use client";

import { useMemo, type CSSProperties } from "react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { ChartPanel } from "@/components/statistics/chart-panel";
import type { TunnelStatistics } from "@/lib/api";
import { topTunnelIdsFromSeries, type StatsTimeBucket } from "@/lib/statistics/time-series";

const SERIES_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

/**
 * Stacked tunnel activity over time, with aggregate totals in the description.
 */
export function TunnelActivityChart({
  series,
  tunnels,
}: {
  readonly series: readonly StatsTimeBucket[];
  readonly tunnels: readonly TunnelStatistics[];
}) {
  const tunnelIds = useMemo(() => topTunnelIdsFromSeries(series, 5), [series]);

  const chartData = useMemo(
    () =>
      series.map((bucket) => {
        const row: Record<string, string | number> = { label: bucket.label };
        for (const id of tunnelIds) {
          row[id] = bucket.byTunnel[id] ?? 0;
        }
        return row;
      }),
    [series, tunnelIds],
  );

  const hasData = tunnelIds.length > 0 && series.some((bucket) => bucket.requests > 0);
  const totalsHint =
    tunnels.length === 0
      ? "Per-tunnel volume over the last 30 minutes"
      : `${tunnels.length} tunnel${tunnels.length === 1 ? "" : "s"} in retained traffic`;

  return (
    <ChartPanel
      title="Tunnel activity"
      description={totalsHint}
      empty={!hasData}
      className="lg:col-span-2"
    >
      <div className="h-64 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              minTickGap={28}
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
              formatter={(value, name) => [String(value ?? 0), shortTunnelLabel(String(name))]}
            />
            <Legend
              formatter={(value) => shortTunnelLabel(String(value))}
              wrapperStyle={{ fontSize: 11, color: "var(--muted-foreground)" }}
            />
            {tunnelIds.map((id, index) => (
              <Area
                key={id}
                type="monotone"
                dataKey={id}
                stackId="tunnels"
                stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
                fill={SERIES_COLORS[index % SERIES_COLORS.length]}
                fillOpacity={0.35}
                strokeWidth={1.5}
                isAnimationActive
                animationDuration={600}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>

      {tunnels.length > 0 ? (
        <ul className="mt-4 grid gap-2 sm:grid-cols-2">
          {tunnels.slice(0, 6).map((tunnel) => (
            <li
              key={tunnel.tunnelId}
              className="flex items-baseline justify-between gap-3 border-t border-border/60 pt-2"
            >
              <span className="truncate font-mono text-xs" title={tunnel.tunnelId}>
                {shortTunnelLabel(tunnel.tunnelId)}
              </span>
              <span className="shrink-0 font-mono text-xs tabular-nums text-muted-foreground">
                {tunnel.totalRequests} · {(tunnel.errorRate * 100).toFixed(0)}% err
                {tunnel.averageLatencyMs !== undefined
                  ? ` · ${Math.round(tunnel.averageLatencyMs)} ms`
                  : ""}
              </span>
            </li>
          ))}
        </ul>
      ) : null}
    </ChartPanel>
  );
}

function shortTunnelLabel(tunnelId: string): string {
  if (tunnelId.length <= 12) {
    return tunnelId;
  }
  return `${tunnelId.slice(0, 6)}…${tunnelId.slice(-4)}`;
}

const tooltipStyle: CSSProperties = {
  background: "var(--card)",
  border: "1px solid var(--border)",
  borderRadius: 8,
  fontSize: 12,
};
