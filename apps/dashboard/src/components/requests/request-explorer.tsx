"use client";

import {
  flexRender,
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table";
import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";

import { requestColumns } from "@/components/requests/request-columns";
import { RequestExplorerPagination } from "@/components/requests/request-explorer-pagination";
import { RequestExplorerToolbar } from "@/components/requests/request-explorer-toolbar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useInspectorRequests } from "@/hooks/use-inspector-requests";
import { ApiError } from "@/lib/api";
import { useConnectionStore } from "@/stores/connection-store";

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Request Explorer — lists recorded traffic with full-text search, filters, sort, and pagination.
 */
export function RequestExplorer() {
  const router = useRouter();
  const liveStatus = useConnectionStore((s) => s.status);

  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [sorting, setSorting] = useState<SortingState>([{ id: "timestamp", desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const { data, isPending, isError, error, refetch, isFetching } = useInspectorRequests({
    q: debouncedSearch.length > 0 ? debouncedSearch : undefined,
  });

  const items = useMemo(() => [...(data?.items ?? [])], [data?.items]);
  const tunnelIds = useMemo(() => [...new Set(items.map((item) => item.tunnelId))].sort(), [items]);

  const table = useReactTable({
    data: items,
    columns: requestColumns,
    state: {
      sorting,
      columnFilters,
    },
    onSortingChange: setSorting,
    onColumnFiltersChange: setColumnFilters,
    getCoreRowModel: getCoreRowModel(),
    getFilteredRowModel: getFilteredRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    getRowId: (row) => row.id,
    initialState: {
      pagination: { pageSize: 25 },
    },
    meta: {
      searchQuery: debouncedSearch,
    },
  });

  if (isPending && debouncedSearch.length === 0) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-full max-w-md" />
        <Skeleton className="h-64 w-full rounded-xl" />
      </div>
    );
  }

  if (isError) {
    const message =
      error instanceof ApiError
        ? `${error.message}${typeof error.body === "string" ? ` — ${error.body}` : ""}`
        : error instanceof Error
          ? error.message.includes("Failed to fetch") || error.name === "NetworkError"
            ? `${error.message}. Is the Badger server running on the configured API URL?`
            : error.message
          : "Failed to load requests";

    return (
      <Alert variant="destructive">
        <AlertTitle>Could not load requests</AlertTitle>
        <AlertDescription className="flex flex-col gap-3">
          <p className="font-mono text-xs">{message}</p>
          <button
            type="button"
            className="w-fit text-sm underline underline-offset-4"
            onClick={() => void refetch()}
          >
            Retry
          </button>
        </AlertDescription>
      </Alert>
    );
  }

  const openRequest = (id: string): void => {
    const params = new URLSearchParams();
    if (debouncedSearch.length > 0) {
      params.set("q", debouncedSearch);
    }
    const suffix = params.toString();
    router.push(`/requests/${encodeURIComponent(id)}${suffix.length > 0 ? `?${suffix}` : ""}`);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-4"
    >
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {data?.count ?? 0} {debouncedSearch.length > 0 ? "matching" : "recorded"}{" "}
            {(data?.count ?? 0) === 1 ? "exchange" : "exchanges"}
            {liveStatus === "connected" ? " · live" : null}
            {isFetching ? " · refreshing…" : null}
          </p>
        </div>
      </div>

      <RequestExplorerToolbar
        table={table}
        tunnelIds={tunnelIds}
        searchQuery={searchInput}
        onSearchQueryChange={setSearchInput}
        searching={isFetching && searchInput.trim() !== debouncedSearch}
      />

      <div className="overflow-hidden rounded-xl border border-border/80">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id} className="hover:bg-transparent">
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length === 0 ? (
              <TableRow className="hover:bg-transparent">
                <TableCell colSpan={requestColumns.length} className="h-32 text-center">
                  <div className="flex flex-col items-center gap-1 py-6">
                    <p className="text-sm font-medium">No requests to show</p>
                    <p className="text-xs text-muted-foreground">
                      {debouncedSearch.length > 0
                        ? "No exchanges matched that search."
                        : items.length === 0
                          ? "Traffic will appear here once the tunnel records exchanges."
                          : "Try adjusting filters."}
                    </p>
                  </div>
                </TableCell>
              </TableRow>
            ) : (
              table.getRowModel().rows.map((row) => (
                <TableRow
                  key={row.id}
                  className="cursor-pointer"
                  onClick={() => openRequest(row.original.id)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault();
                      openRequest(row.original.id);
                    }
                  }}
                  tabIndex={0}
                  role="link"
                  aria-label={`Open request ${row.original.id}`}
                >
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(cell.column.columnDef.cell, cell.getContext())}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      <RequestExplorerPagination table={table} />
    </motion.div>
  );
}
