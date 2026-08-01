"use client";

import { ChevronDownIcon } from "lucide-react";
import { useState } from "react";

import { HighlightText } from "@/components/requests/highlight-text";
import { groupHeaderEntries } from "@/components/requests/header-groups";
import type { KeyValueEntry } from "@/lib/request-body";
import { cn } from "@/lib/utils";

interface KeyValueTableProps {
  readonly entries: readonly KeyValueEntry[];
  readonly emptyLabel?: string;
  readonly className?: string;
  readonly highlightQuery?: string;
  /** When true, render DevTools-style grouped sections. */
  readonly grouped?: boolean;
}

/**
 * Two-column key/value list for headers, cookies, and query params.
 */
export function KeyValueTable({
  entries,
  emptyLabel = "None",
  className,
  highlightQuery = "",
  grouped = false,
}: KeyValueTableProps) {
  if (entries.length === 0) {
    return (
      <div
        className={cn(
          "rounded-[10px] border border-dashed border-ash-stroke px-3 py-8 text-center text-sm text-warm-granite",
          className,
        )}
      >
        {emptyLabel}
      </div>
    );
  }

  if (!grouped) {
    return (
      <div
        className={cn(
          "overflow-hidden rounded-[10px] border border-ash-stroke shadow-hairline",
          className,
        )}
      >
        <HeaderTable entries={entries} highlightQuery={highlightQuery} />
      </div>
    );
  }

  const groups = groupHeaderEntries(entries);

  return (
    <div className={cn("space-y-3", className)}>
      {groups.map((group) => (
        <HeaderGroupPanel
          key={group.id}
          label={group.label}
          count={group.entries.length}
          entries={group.entries}
          highlightQuery={highlightQuery}
        />
      ))}
    </div>
  );
}

function HeaderGroupPanel({
  label,
  count,
  entries,
  highlightQuery,
}: {
  readonly label: string;
  readonly count: number;
  readonly entries: readonly KeyValueEntry[];
  readonly highlightQuery: string;
}) {
  const [open, setOpen] = useState(true);

  return (
    <div className="overflow-hidden rounded-[10px] border border-ash-stroke shadow-hairline">
      <button
        type="button"
        className="flex w-full items-center gap-2 bg-carbon-lift px-3 py-2.5 text-left transition-machine hover:bg-[color-mix(in_srgb,#1d1a18_90%,#eeeeee)]"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
      >
        <ChevronDownIcon
          className={cn(
            "size-3.5 text-warm-granite transition-transform duration-200",
            !open && "-rotate-90",
          )}
        />
        <span className="text-caption text-pale-stone">{label}</span>
        <span className="ml-auto font-mono text-[11px] text-warm-granite tabular-nums">
          {count}
        </span>
      </button>
      {open ? <HeaderTable entries={entries} highlightQuery={highlightQuery} /> : null}
    </div>
  );
}

function HeaderTable({
  entries,
  highlightQuery,
}: {
  readonly entries: readonly KeyValueEntry[];
  readonly highlightQuery: string;
}) {
  return (
    <table className="w-full text-left text-sm">
      <tbody>
        {entries.map((entry, index) => (
          <tr
            key={`${entry.key}-${String(index)}`}
            className="border-t border-ash-stroke transition-machine hover:bg-carbon-lift/60"
          >
            <th className="w-[34%] max-w-[16rem] bg-obsidian-canvas/50 px-3 py-2 align-top font-mono text-xs font-normal text-pale-stone break-all">
              <HighlightText text={entry.key} query={highlightQuery} />
            </th>
            <td className="px-3 py-2 align-top font-mono text-xs break-all whitespace-pre-wrap text-bone">
              {entry.value.length > 0 ? (
                <HighlightText text={entry.value} query={highlightQuery} />
              ) : (
                <span className="text-warm-granite">—</span>
              )}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
