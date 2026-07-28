"use client";

import type { ColumnDef, FilterFn, RowData } from "@tanstack/react-table";

import { DataTableColumnHeader } from "@/components/requests/data-table-column-header";
import { HighlightText, MatchFieldBadges } from "@/components/requests/highlight-text";
import { MethodBadge } from "@/components/requests/method-badge";
import { StatusBadge } from "@/components/requests/status-badge";
import type { InspectorRequestSummary } from "@/lib/api";

declare module "@tanstack/react-table" {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  interface TableMeta<TData extends RowData> {
    searchQuery?: string;
  }
}

export const statusClassFilterFn: FilterFn<InspectorRequestSummary> = (
  row,
  columnId,
  filterValue,
) => {
  const selected = String(filterValue ?? "all");
  if (selected === "all") {
    return true;
  }

  const status = row.getValue<number | undefined>(columnId);
  if (selected === "pending") {
    return status === undefined;
  }

  if (status === undefined) {
    return false;
  }

  return String(Math.floor(status / 100)) === selected;
};

function formatTimestamp(epochMs: number): string {
  try {
    return new Intl.DateTimeFormat(undefined, {
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date(epochMs));
  } catch {
    return new Date(epochMs).toISOString();
  }
}

function formatLatency(latencyMs: number | undefined): string {
  if (latencyMs === undefined) {
    return "—";
  }
  if (latencyMs < 1_000) {
    return `${latencyMs} ms`;
  }
  return `${(latencyMs / 1_000).toFixed(2)} s`;
}

function searchQueryFrom(ctx: { table: { options: { meta?: { searchQuery?: string } } } }): string {
  return ctx.table.options.meta?.searchQuery?.trim() ?? "";
}

/**
 * TanStack Table column definitions for the Request Explorer (with highlight support).
 */
export const requestColumns: ColumnDef<InspectorRequestSummary>[] = [
  {
    accessorKey: "method",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Method" />,
    cell: ({ row, table }) => {
      const query = table.options.meta?.searchQuery?.trim() ?? "";
      const matched = row.original.matches?.includes("method");
      if (query.length > 0 && matched) {
        return (
          <HighlightText
            text={row.original.method}
            query={query}
            className="font-mono text-[11px] tracking-wide uppercase"
          />
        );
      }
      return <MethodBadge method={row.original.method} />;
    },
    filterFn: (row, id, value) => {
      const selected = String(value ?? "all");
      if (selected === "all") {
        return true;
      }
      return String(row.getValue(id)).toUpperCase() === selected.toUpperCase();
    },
  },
  {
    id: "url",
    accessorKey: "path",
    header: ({ column }) => <DataTableColumnHeader column={column} title="URL" />,
    cell: ({ row, table }) => {
      const query = searchQueryFrom({ table });
      return (
        <div className="flex min-w-0 flex-col gap-1">
          <HighlightText
            text={row.original.path}
            query={query}
            className="block max-w-[28rem] truncate font-mono text-xs"
          />
          {row.original.matches !== undefined && row.original.matches.length > 0 ? (
            <MatchFieldBadges matches={row.original.matches} />
          ) : null}
        </div>
      );
    },
  },
  {
    accessorKey: "status",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Status" />,
    cell: ({ row, table }) => {
      const query = searchQueryFrom({ table });
      const statusText = row.original.status === undefined ? "—" : String(row.original.status);
      if (query.length > 0 && row.original.matches?.includes("status")) {
        return <HighlightText text={statusText} query={query} className="font-mono text-xs" />;
      }
      return <StatusBadge status={row.original.status} />;
    },
    filterFn: statusClassFilterFn,
    sortingFn: (a, b) => {
      const left = a.original.status ?? -1;
      const right = b.original.status ?? -1;
      return left - right;
    },
  },
  {
    accessorKey: "latencyMs",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Latency" />,
    cell: ({ row }) => (
      <span className="font-mono text-xs tabular-nums text-muted-foreground">
        {formatLatency(row.original.latencyMs)}
      </span>
    ),
    sortingFn: (a, b) => {
      const left = a.original.latencyMs ?? Number.POSITIVE_INFINITY;
      const right = b.original.latencyMs ?? Number.POSITIVE_INFINITY;
      return left - right;
    },
  },
  {
    accessorKey: "timestamp",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Timestamp" />,
    cell: ({ row, table }) => {
      const query = searchQueryFrom({ table });
      const formatted = formatTimestamp(row.original.timestamp);
      return (
        <HighlightText
          text={formatted}
          query={query}
          className="font-mono text-xs tabular-nums text-muted-foreground"
        />
      );
    },
  },
  {
    accessorKey: "tunnelId",
    header: ({ column }) => <DataTableColumnHeader column={column} title="Tunnel" />,
    cell: ({ row, table }) => {
      const query = searchQueryFrom({ table });
      return (
        <HighlightText
          text={row.original.tunnelId}
          query={query}
          className="block max-w-[10rem] truncate font-mono text-xs"
        />
      );
    },
    filterFn: (row, id, value) => {
      const selected = String(value ?? "all");
      if (selected === "all") {
        return true;
      }
      return String(row.getValue(id)) === selected;
    },
  },
];
