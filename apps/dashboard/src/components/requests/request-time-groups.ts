import type { InspectorRequestSummary } from "@/lib/api";

export interface RequestTimeGroup {
  readonly key: string;
  readonly label: string;
  readonly items: readonly InspectorRequestSummary[];
}

/**
 * Groups requests into calendar-day buckets for the timeline explorer.
 * Assumes items are already sorted (newest first).
 */
export function groupRequestsByTime(
  items: readonly InspectorRequestSummary[],
  now = Date.now(),
): readonly RequestTimeGroup[] {
  const todayStart = startOfLocalDay(now);
  const yesterdayStart = todayStart - 86_400_000;

  const buckets = new Map<
    string,
    { key: string; label: string; items: InspectorRequestSummary[]; order: number }
  >();

  for (const item of items) {
    const dayStart = startOfLocalDay(item.timestamp);
    let key: string;
    let label: string;
    let order: number;

    if (dayStart === todayStart) {
      key = "today";
      label = "Today";
      order = 0;
    } else if (dayStart === yesterdayStart) {
      key = "yesterday";
      label = "Yesterday";
      order = 1;
    } else {
      key = `day-${String(dayStart)}`;
      label = formatDayLabel(dayStart);
      order = 2 + Math.floor((todayStart - dayStart) / 86_400_000);
    }

    const existing = buckets.get(key);
    if (existing === undefined) {
      buckets.set(key, { key, label, items: [item], order });
    } else {
      existing.items.push(item);
    }
  }

  return [...buckets.values()]
    .sort((a, b) => a.order - b.order)
    .map((bucket) => ({
      key: bucket.key,
      label: bucket.label,
      items: bucket.items,
    }));
}

/**
 * Relative time label for dense timeline rows.
 */
export function formatRelativeTime(timestamp: number, now = Date.now()): string {
  const delta = Math.max(0, now - timestamp);
  if (delta < 5_000) {
    return "just now";
  }
  if (delta < 60_000) {
    return `${String(Math.floor(delta / 1_000))}s ago`;
  }
  if (delta < 3_600_000) {
    return `${String(Math.floor(delta / 60_000))}m ago`;
  }
  if (delta < 86_400_000) {
    return `${String(Math.floor(delta / 3_600_000))}h ago`;
  }
  return formatClock(timestamp);
}

export function formatClock(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
}

export function formatLatency(latencyMs: number | undefined): string {
  if (latencyMs === undefined) {
    return "—";
  }
  if (latencyMs < 1_000) {
    return `${String(latencyMs)}ms`;
  }
  return `${(latencyMs / 1_000).toFixed(2)}s`;
}

/**
 * Status accent for left rail / timeline dots.
 */
export function statusAccent(status: number | undefined): "pending" | "ok" | "redirect" | "client" | "server" | "unknown" {
  if (status === undefined) {
    return "pending";
  }
  const bucket = Math.floor(status / 100);
  if (bucket === 2) {
    return "ok";
  }
  if (bucket === 3) {
    return "redirect";
  }
  if (bucket === 4) {
    return "client";
  }
  if (bucket === 5) {
    return "server";
  }
  return "unknown";
}

function startOfLocalDay(epochMs: number): number {
  const date = new Date(epochMs);
  date.setHours(0, 0, 0, 0);
  return date.getTime();
}

function formatDayLabel(dayStart: number): string {
  return new Intl.DateTimeFormat(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(dayStart));
}
