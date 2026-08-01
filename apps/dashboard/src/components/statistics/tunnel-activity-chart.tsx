"use client";

import { useMemo } from "react";
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

import {
  ChartPanel,
  chartGridStroke,
  chartTickStyle,
  chartTooltipStyle,
} from "@/components/statistics/chart-panel";
import type { TunnelStatistics } from "@/lib/api";
import { topTunnelIdsFromSeries, type StatsTimeBucket } from "@/lib/statistics/time-series";

const SERIES_COLORS = ["#ee6018", "#a0ca92", "#b8b3b0", "#8a8380", "#eeeeee"] as const;

/**
 * Stacked tunnel activity over time, with aggregate totals in the footer.
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
      : `${String(tunnels.length)} tunnel${tunnels.length === 1 ? "" : "s"} in retained traffic`;

  return (
    <ChartPanel
      title="Tunnel activity"
      description={totalsHint}
      empty={!hasData}
      className="lg:col-span-2"
      footer={
        tunnels.length > 0 ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {tunnels.slice(0, 6).map((tunnel) => (
              <li
                key={tunnel.tunnelId}
                className="flex items-baseline justify-between gap-3 border-t border-ash-stroke pt-2.5"
              >
                <span
                  className="truncate font-mono text-xs text-bone"
                  title={tunnel.tunnelId}
                >
                  {shortTunnelLabel(tunnel.tunnelId)}
                </span>
                <span className="shrink-0 font-mono text-xs text-warm-granite tabular-nums">
                  {tunnel.totalRequests} · {(tunnel.errorRate * 100).toFixed(0)}% err
                  {tunnel.averageLatencyMs !== undefined
                    ? ` · ${String(Math.round(tunnel.averageLatencyMs))} ms`
                    : ""}
                </span>
              </li>
            ))}
          </ul>
        ) : null
      }
    >
      <div className="h-56 w-full sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
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
              formatter={(value, name) => [String(value ?? 0), shortTunnelLabel(String(name))]}
            />
            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              iconSize={8}
              formatter={(value) => shortTunnelLabel(String(value))}
              wrapperStyle={{ fontSize: 11, color: "#8a8380", paddingBottom: 8 }}
            />
            {tunnelIds.map((id, index) => (
              <Area
                key={id}
                type="monotone"
                dataKey={id}
                name={id}
                stackId="tunnels"
                stroke={SERIES_COLORS[index % SERIES_COLORS.length]}
                fill={SERIES_COLORS[index % SERIES_COLORS.length]}
                fillOpacity={0.28}
                strokeWidth={1.5}
                isAnimationActive
                animationDuration={600}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </ChartPanel>
  );
}

function shortTunnelLabel(tunnelId: string): string {
  if (tunnelId.length <= 12) {
    return tunnelId;
  }
  return `${tunnelId.slice(0, 6)}…${tunnelId.slice(-4)}`;
}
