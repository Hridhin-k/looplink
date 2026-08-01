"use client";

import type { Table } from "@tanstack/react-table";
import { ArrowDownWideNarrowIcon, FilterIcon, SearchIcon, XIcon } from "lucide-react";
import { useRef, type RefObject } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { InspectorRequestSummary } from "@/lib/api";
import { cn } from "@/lib/utils";

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;

const STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "2", label: "2xx" },
  { value: "3", label: "3xx" },
  { value: "4", label: "4xx" },
  { value: "5", label: "5xx" },
  { value: "pending", label: "Pending" },
] as const;

const SORT_OPTIONS = [
  { id: "timestamp", label: "Time", desc: true },
  { id: "latencyMs", label: "Latency", desc: true },
  { id: "status", label: "Status", desc: false },
  { id: "method", label: "Method", desc: false },
] as const;

interface RequestExplorerToolbarProps {
  readonly table: Table<InspectorRequestSummary>;
  readonly tunnelIds: readonly string[];
  readonly searchQuery: string;
  readonly onSearchQueryChange: (value: string) => void;
  readonly searching?: boolean;
  readonly searchInputRef?: RefObject<HTMLInputElement | null>;
  readonly className?: string;
}

function columnFilterValue(table: Table<InspectorRequestSummary>, id: string): string {
  const value = table.getColumn(id)?.getFilterValue();
  return typeof value === "string" && value.length > 0 ? value : "all";
}

/**
 * Sticky search + floating filter bar for the Request Explorer.
 */
export function RequestExplorerToolbar({
  table,
  tunnelIds,
  searchQuery,
  onSearchQueryChange,
  searching = false,
  searchInputRef,
  className,
}: RequestExplorerToolbarProps) {
  const localRef = useRef<HTMLInputElement>(null);
  const inputRef = searchInputRef ?? localRef;

  const method = columnFilterValue(table, "method");
  const status = columnFilterValue(table, "status");
  const tunnel = columnFilterValue(table, "tunnelId");
  const sorting = table.getState().sorting[0];
  const sortValue = sorting?.id ?? "timestamp";

  const activeFilterCount = [method, status, tunnel].filter((value) => value !== "all").length;
  const hasFilters = searchQuery.trim().length > 0 || activeFilterCount > 0;

  return (
    <div
      className={cn(
        "sticky top-14 z-20 -mx-4 space-y-3 border-b border-ash-stroke/80 bg-obsidian-canvas/95 px-4 py-3 backdrop-blur-md sm:top-16 sm:-mx-6 sm:px-6 md:-mx-8 md:px-8",
        className,
      )}
    >
      <div className="relative w-full">
        <SearchIcon className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-warm-granite" />
        <Input
          ref={inputRef}
          value={searchQuery}
          onChange={(event) => onSearchQueryChange(event.target.value)}
          placeholder="Search URL, headers, method, body, response, tunnel, status…  (/)"
          className="h-10 rounded-[3px] border-ash-stroke bg-carbon-lift pl-10 pr-24 text-sm"
          aria-label="Full-text search requests"
        />
        <div className="absolute top-1/2 right-2.5 flex -translate-y-1/2 items-center gap-2">
          {searching ? (
            <span className="text-caption text-warm-granite">Searching…</span>
          ) : null}
          {searchQuery.length > 0 ? (
            <Button
              type="button"
              variant="ghost"
              size="icon-xs"
              aria-label="Clear search"
              onClick={() => onSearchQueryChange("")}
            >
              <XIcon className="size-3.5" />
            </Button>
          ) : null}
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-ash-stroke/80 bg-carbon-lift/80 p-2 shadow-panel">
        <span className="inline-flex items-center gap-1.5 px-1.5 text-caption text-pale-stone">
          <FilterIcon className="size-3" />
          Filters
          {activeFilterCount > 0 ? (
            <span className="rounded-[3px] bg-obsidian-canvas px-1.5 py-0.5 font-mono text-[10px] text-bone tabular-nums">
              {activeFilterCount}
            </span>
          ) : null}
        </span>

        <Select
          value={method}
          onValueChange={(value) => {
            if (value === null) {
              return;
            }
            table.getColumn("method")?.setFilterValue(value === "all" ? undefined : value);
          }}
        >
          <SelectTrigger className="w-[8.5rem] rounded-[3px]" size="sm" aria-label="Filter by method">
            <SelectValue placeholder="Method" />
          </SelectTrigger>
          <SelectContent align="start">
            <SelectItem value="all">All methods</SelectItem>
            {METHODS.map((item) => (
              <SelectItem key={item} value={item}>
                {item}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={status}
          onValueChange={(value) => {
            if (value === null) {
              return;
            }
            table.getColumn("status")?.setFilterValue(value === "all" ? undefined : value);
          }}
        >
          <SelectTrigger className="w-[8.5rem] rounded-[3px]" size="sm" aria-label="Filter by status">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent align="start">
            {STATUS_FILTERS.map((item) => (
              <SelectItem key={item.value} value={item.value}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select
          value={tunnel}
          onValueChange={(value) => {
            if (value === null) {
              return;
            }
            table.getColumn("tunnelId")?.setFilterValue(value === "all" ? undefined : value);
          }}
        >
          <SelectTrigger className="w-[10rem] rounded-[3px]" size="sm" aria-label="Filter by tunnel">
            <SelectValue placeholder="Tunnel" />
          </SelectTrigger>
          <SelectContent align="start">
            <SelectItem value="all">All tunnels</SelectItem>
            {tunnelIds.map((id) => (
              <SelectItem key={id} value={id}>
                {id}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <span className="mx-1 hidden h-5 w-px bg-ash-stroke sm:block" aria-hidden />

        <span className="inline-flex items-center gap-1.5 px-1.5 text-caption text-pale-stone">
          <ArrowDownWideNarrowIcon className="size-3" />
          Sort
        </span>

        <Select
          value={sortValue}
          onValueChange={(value) => {
            if (value === null) {
              return;
            }
            const option = SORT_OPTIONS.find((item) => item.id === value);
            table.setSorting([{ id: value, desc: option?.desc ?? true }]);
          }}
        >
          <SelectTrigger className="w-[8rem] rounded-[3px]" size="sm" aria-label="Sort requests">
            <SelectValue placeholder="Sort" />
          </SelectTrigger>
          <SelectContent align="end">
            {SORT_OPTIONS.map((item) => (
              <SelectItem key={item.id} value={item.id}>
                {item.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        {hasFilters ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="ml-auto"
            onClick={() => {
              table.resetColumnFilters();
              onSearchQueryChange("");
            }}
          >
            <XIcon className="size-3.5" />
            Reset
          </Button>
        ) : null}
      </div>
    </div>
  );
}
