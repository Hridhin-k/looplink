"use client";

import type { Table } from "@tanstack/react-table";
import { SearchIcon, XIcon } from "lucide-react";

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

const METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"] as const;

const STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  { value: "2", label: "2xx" },
  { value: "3", label: "3xx" },
  { value: "4", label: "4xx" },
  { value: "5", label: "5xx" },
  { value: "pending", label: "Pending" },
] as const;

interface RequestExplorerToolbarProps {
  readonly table: Table<InspectorRequestSummary>;
  readonly tunnelIds: readonly string[];
  readonly searchQuery: string;
  readonly onSearchQueryChange: (value: string) => void;
  readonly searching?: boolean;
}

function columnFilterValue(table: Table<InspectorRequestSummary>, id: string): string {
  const value = table.getColumn(id)?.getFilterValue();
  return typeof value === "string" && value.length > 0 ? value : "all";
}

/**
 * Full-text search + method / status / tunnel filters for the Request Explorer.
 */
export function RequestExplorerToolbar({
  table,
  tunnelIds,
  searchQuery,
  onSearchQueryChange,
  searching = false,
}: RequestExplorerToolbarProps) {
  const method = columnFilterValue(table, "method");
  const status = columnFilterValue(table, "status");
  const tunnel = columnFilterValue(table, "tunnelId");

  const hasFilters =
    searchQuery.trim().length > 0 || method !== "all" || status !== "all" || tunnel !== "all";

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full max-w-xl">
          <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(event) => onSearchQueryChange(event.target.value)}
            placeholder="Search URL, headers, method, body, response, tunnel, status, timestamp…"
            className="pl-8"
            aria-label="Full-text search requests"
          />
          {searching ? (
            <span className="absolute top-1/2 right-2.5 -translate-y-1/2 text-[10px] text-muted-foreground">
              Searching…
            </span>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={method}
            onValueChange={(value) => {
              if (value === null) {
                return;
              }
              table.getColumn("method")?.setFilterValue(value === "all" ? undefined : value);
            }}
          >
            <SelectTrigger className="w-[9.5rem]" size="sm" aria-label="Filter by method">
              <SelectValue placeholder="Method" />
            </SelectTrigger>
            <SelectContent align="end">
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
            <SelectTrigger className="w-[9.5rem]" size="sm" aria-label="Filter by status">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent align="end">
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
            <SelectTrigger className="w-[11rem]" size="sm" aria-label="Filter by tunnel">
              <SelectValue placeholder="Tunnel" />
            </SelectTrigger>
            <SelectContent align="end">
              <SelectItem value="all">All tunnels</SelectItem>
              {tunnelIds.map((id) => (
                <SelectItem key={id} value={id}>
                  {id}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {hasFilters ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
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
    </div>
  );
}
