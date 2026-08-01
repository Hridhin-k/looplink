"use client";

import {
  getCoreRowModel,
  getFilteredRowModel,
  getPaginationRowModel,
  getSortedRowModel,
  useReactTable,
  type ColumnFiltersState,
  type SortingState,
} from "@tanstack/react-table";
import { AnimatePresence, motion } from "framer-motion";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

import { EmptyState } from "@/components/layout/empty-state";
import { LiveMeta } from "@/components/layout/surface";
import { PageHeader } from "@/components/layout/page-header";
import { ExplorerRequestCard } from "@/components/requests/explorer-request-card";
import { requestColumns } from "@/components/requests/request-columns";
import { RequestExplorerPagination } from "@/components/requests/request-explorer-pagination";
import { RequestExplorerToolbar } from "@/components/requests/request-explorer-toolbar";
import { groupRequestsByTime } from "@/components/requests/request-time-groups";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useInspectorRequests } from "@/hooks/use-inspector-requests";
import { ApiError } from "@/lib/api";
import { useConnectionStore } from "@/stores/connection-store";

const SEARCH_DEBOUNCE_MS = 300;
const FEED_EASE = [0.4, 0, 0.2, 1] as const;

/**
 * Request Explorer — timeline of expandable request cards.
 *
 * Preserves search, filters, sort, pagination, live updates, and detail navigation.
 */
export function RequestExplorer() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const live = useConnectionStore((s) => s.status) === "connected";
  const searchInputRef = useRef<HTMLInputElement>(null);
  const cardRefs = useRef(new Map<string, HTMLElement>());

  const initialQ = searchParams.get("q")?.trim() ?? "";
  const [searchInput, setSearchInput] = useState(initialQ);
  const [debouncedSearch, setDebouncedSearch] = useState(initialQ);
  const [sorting, setSorting] = useState<SortingState>([{ id: "timestamp", desc: true }]);
  const [columnFilters, setColumnFilters] = useState<ColumnFiltersState>([]);
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => new Set());
  const [focusedId, setFocusedId] = useState<string | null>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setDebouncedSearch(searchInput.trim());
    }, SEARCH_DEBOUNCE_MS);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  useEffect(() => {
    const fromUrl = searchParams.get("q")?.trim() ?? "";
    setSearchInput((current) => (current === fromUrl ? current : fromUrl));
    setDebouncedSearch((current) => (current === fromUrl ? current : fromUrl));
  }, [searchParams]);

  const urlQ = searchParams.get("q")?.trim() ?? "";

  useEffect(() => {
    if (debouncedSearch === urlQ) {
      return;
    }
    const current = new URLSearchParams(searchParams.toString());
    if (debouncedSearch.length > 0) {
      current.set("q", debouncedSearch);
    } else {
      current.delete("q");
    }
    const qs = current.toString();
    router.replace(qs.length > 0 ? `/requests?${qs}` : "/requests", { scroll: false });
  }, [debouncedSearch, urlQ, router, searchParams]);

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

  const pageRows = table.getRowModel().rows;
  const pageItems = useMemo(() => pageRows.map((row) => row.original), [pageRows]);
  const groups = useMemo(() => groupRequestsByTime(pageItems), [pageItems]);
  const pageIds = useMemo(() => pageItems.map((item) => item.id), [pageItems]);

  const maxLatencyMs = useMemo(() => {
    let max = 250;
    for (const item of pageItems) {
      if (item.latencyMs !== undefined && item.latencyMs > max) {
        max = item.latencyMs;
      }
    }
    return Math.max(max, 250);
  }, [pageItems]);

  useEffect(() => {
    if (focusedId !== null && pageIds.includes(focusedId)) {
      return;
    }
    setFocusedId(pageIds[0] ?? null);
  }, [focusedId, pageIds]);

  const detailHref = useCallback(
    (id: string): string => {
      const params = new URLSearchParams();
      if (debouncedSearch.length > 0) {
        params.set("q", debouncedSearch);
      }
      const suffix = params.toString();
      return `/requests/${encodeURIComponent(id)}${suffix.length > 0 ? `?${suffix}` : ""}`;
    },
    [debouncedSearch],
  );

  const openRequest = useCallback(
    (id: string): void => {
      router.push(detailHref(id));
    },
    [detailHref, router],
  );

  const toggleExpanded = useCallback((id: string): void => {
    setExpandedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const focusIndex = useCallback(
    (index: number): void => {
      const id = pageIds[index];
      if (id === undefined) {
        return;
      }
      setFocusedId(id);
      cardRefs.current.get(id)?.focus();
    },
    [pageIds],
  );

  const onTimelineKeyDown = useCallback(
    (event: ReactKeyboardEvent<HTMLDivElement>): void => {
      const target = event.target as HTMLElement | null;
      if (
        target !== null &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.key === "/" && !event.metaKey && !event.ctrlKey) {
        event.preventDefault();
        searchInputRef.current?.focus();
        return;
      }

      if (pageIds.length === 0 || focusedId === null) {
        return;
      }

      const index = pageIds.indexOf(focusedId);
      if (index === -1) {
        return;
      }

      if (event.key === "j" || event.key === "ArrowDown") {
        event.preventDefault();
        focusIndex(Math.min(index + 1, pageIds.length - 1));
        return;
      }
      if (event.key === "k" || event.key === "ArrowUp") {
        event.preventDefault();
        focusIndex(Math.max(index - 1, 0));
        return;
      }
      if (event.key === "x" || event.key === "e") {
        event.preventDefault();
        toggleExpanded(focusedId);
        return;
      }
      if (event.key === "o") {
        event.preventDefault();
        openRequest(focusedId);
      }
    },
    [focusIndex, focusedId, openRequest, pageIds, toggleExpanded],
  );

  if (isPending && debouncedSearch.length === 0) {
    return <ExplorerLoading live={live} />;
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
      <div className="space-y-8">
        <PageHeader eyebrow="Requests" title="Request explorer" meta={<LiveMeta live={live} />} />
        <Alert variant="destructive">
          <AlertTitle>Could not load requests</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <p className="font-mono text-xs">{message}</p>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="w-fit"
              onClick={() => void refetch()}
            >
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const emptyTitle =
    debouncedSearch.length > 0
      ? "No matches"
      : items.length === 0
        ? "No traffic yet"
        : "Nothing in this view";

  const emptyDescription =
    debouncedSearch.length > 0
      ? "No exchanges matched that search. Try a different query or clear filters."
      : items.length === 0
        ? "Start a Badger tunnel and send a request — exchanges will stream into this timeline."
        : "Try adjusting method, status, or tunnel filters.";

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: FEED_EASE }}
      className="flex flex-col gap-6"
      onKeyDown={onTimelineKeyDown}
    >
      <PageHeader
        eyebrow="Requests"
        title="Request explorer"
        description={
          <>
            {data?.count ?? 0} {debouncedSearch.length > 0 ? "matching" : "recorded"}{" "}
            {(data?.count ?? 0) === 1 ? "exchange" : "exchanges"}
            {isFetching ? " · refreshing…" : null}
            <span className="mt-1 block text-xs text-warm-granite">
              Keys: <kbd className="font-mono">j</kbd>/<kbd className="font-mono">k</kbd> move ·{" "}
              <kbd className="font-mono">x</kbd> expand · <kbd className="font-mono">o</kbd> open ·{" "}
              <kbd className="font-mono">/</kbd> search
            </span>
          </>
        }
        meta={<LiveMeta live={live} liveLabel="Live" idleLabel="Idle" />}
      />

      <RequestExplorerToolbar
        table={table}
        tunnelIds={tunnelIds}
        searchQuery={searchInput}
        onSearchQueryChange={setSearchInput}
        searching={isFetching && searchInput.trim() !== debouncedSearch}
        searchInputRef={searchInputRef}
      />

      {pageItems.length === 0 ? (
        <EmptyState
          eyebrow="No results"
          title={emptyTitle}
          description={emptyDescription}
          actions={
            items.length === 0 ? (
              <>
                <Link
                  href="/overview"
                  className="inline-flex h-8 items-center rounded-[3px] bg-chalk px-3.5 text-sm text-obsidian-canvas transition-machine hover:bg-bone"
                >
                  Live activity
                </Link>
                <Link
                  href="/workspace"
                  className="inline-flex h-8 items-center rounded-[3px] border border-ash-stroke px-3.5 text-sm text-bone transition-machine hover:border-pale-stone hover:bg-carbon-lift"
                >
                  Workspace
                </Link>
              </>
            ) : (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  table.resetColumnFilters();
                  setSearchInput("");
                }}
              >
                Clear filters
              </Button>
            )
          }
          footer={
            items.length === 0 ? (
              <pre className="overflow-x-auto rounded-[3px] border border-ash-stroke bg-carbon-lift p-4 font-mono text-xs text-pale-stone">
                {`badger login\nbadger 3000\ncurl https://<your-tunnel-host>/`}
              </pre>
            ) : undefined
          }
        />
      ) : (
        <div className="relative space-y-8" role="list" aria-label="Request timeline">
          <div
            className="pointer-events-none absolute top-2 bottom-2 left-[1.7rem] w-px bg-ash-stroke/70 sm:left-[2rem]"
            aria-hidden
          />

          {groups.map((group) => (
            <section key={group.key} className="relative space-y-3" aria-labelledby={`group-${group.key}`}>
              <div className="sticky top-[10.5rem] z-10 -ml-1 flex items-center gap-3 bg-obsidian-canvas/90 py-1 backdrop-blur-sm sm:top-[11.25rem]">
                <span className="relative z-10 size-2.5 shrink-0 rounded-full border border-ash-stroke bg-obsidian-canvas" />
                <h2
                  id={`group-${group.key}`}
                  className="text-caption text-pale-stone"
                >
                  {group.label}
                  <span className="ml-2 font-mono text-warm-granite tabular-nums">
                    {group.items.length}
                  </span>
                </h2>
              </div>

              <ul className="relative space-y-2.5 pl-0">
                <AnimatePresence initial={false}>
                  {group.items.map((item) => (
                    <motion.li
                      key={item.id}
                      layout
                      initial={{ opacity: 0, y: -6 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
                      role="listitem"
                    >
                      <ExplorerRequestCard
                        request={item}
                        searchQuery={debouncedSearch}
                        expanded={expandedIds.has(item.id)}
                        focused={focusedId === item.id}
                        maxLatencyMs={maxLatencyMs}
                        detailHref={detailHref(item.id)}
                        onToggle={() => toggleExpanded(item.id)}
                        onFocus={() => setFocusedId(item.id)}
                        onOpen={() => openRequest(item.id)}
                        cardRef={(node) => {
                          if (node === null) {
                            cardRefs.current.delete(item.id);
                          } else {
                            cardRefs.current.set(item.id, node);
                          }
                        }}
                      />
                    </motion.li>
                  ))}
                </AnimatePresence>
              </ul>
            </section>
          ))}
        </div>
      )}

      <RequestExplorerPagination table={table} />
    </motion.div>
  );
}

function ExplorerLoading({ live }: { readonly live: boolean }) {
  return (
    <div className="space-y-6">
      <PageHeader eyebrow="Requests" title="Request explorer" meta={<LiveMeta live={live} />} />
      <div className="space-y-3 rounded-[10px] border border-ash-stroke bg-carbon-lift/40 p-3">
        <Skeleton className="h-10 w-full rounded-[3px]" />
        <Skeleton className="h-10 w-full rounded-[10px]" />
      </div>
      <div className="space-y-3">
        <Skeleton className="h-3 w-20" />
        {Array.from({ length: 5 }, (_, index) => (
          <div
            key={index}
            className="flex gap-4 rounded-[10px] border border-ash-stroke bg-carbon-lift p-3.5"
          >
            <div className="flex w-14 flex-col items-center gap-2 pt-1">
              <Skeleton className="size-2 rounded-full" />
              <Skeleton className="h-3 w-10" />
            </div>
            <div className="min-w-0 flex-1 space-y-2.5">
              <div className="flex gap-2">
                <Skeleton className="h-5 w-14 rounded-[3px]" />
                <Skeleton className="h-5 w-10 rounded-[3px]" />
              </div>
              <Skeleton className="h-4 w-3/4 max-w-md" />
              <Skeleton className="h-1.5 w-40 rounded-full" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
