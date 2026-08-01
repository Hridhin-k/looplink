"use client";

import { cn } from "@/lib/utils";

interface HighlightTextProps {
  readonly text: string;
  readonly query: string;
  readonly className?: string;
}

/**
 * Renders `text` with case-insensitive `query` matches wrapped in `<mark>`.
 */
export function HighlightText({ text, query, className }: HighlightTextProps) {
  const trimmed = query.trim();
  if (trimmed.length === 0 || text.length === 0) {
    return <span className={className}>{text}</span>;
  }

  const parts = splitHighlight(text, trimmed);
  return (
    <span className={className}>
      {parts.map((part, index) =>
        part.highlight ? (
          <mark
            key={`${part.value}-${String(index)}`}
            className="rounded-sm bg-signal-orange/25 px-0.5 text-inherit"
          >
            {part.value}
          </mark>
        ) : (
          <span key={`${part.value}-${String(index)}`}>{part.value}</span>
        ),
      )}
    </span>
  );
}

/**
 * Escapes a string for safe use inside a RegExp source.
 */
export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Splits text into highlighted / plain segments for a query.
 */
export function splitHighlight(
  text: string,
  query: string,
): readonly { readonly value: string; readonly highlight: boolean }[] {
  const trimmed = query.trim();
  if (trimmed.length === 0) {
    return [{ value: text, highlight: false }];
  }

  const pattern = new RegExp(`(${escapeRegExp(trimmed)})`, "ig");
  const parts = text.split(pattern);
  if (parts.length === 1) {
    return [{ value: text, highlight: false }];
  }

  const lower = trimmed.toLowerCase();
  return parts
    .filter((part) => part.length > 0)
    .map((part) => ({
      value: part,
      highlight: part.toLowerCase() === lower,
    }));
}

/**
 * Human labels for traffic search match field ids.
 */
export const SEARCH_FIELD_LABELS: Record<string, string> = {
  url: "URL",
  headers: "Headers",
  method: "Method",
  body: "Body",
  response: "Response",
  tunnel: "Tunnel",
  status: "Status",
  timestamp: "Timestamp",
};

interface MatchFieldBadgesProps {
  readonly matches: readonly string[];
  readonly className?: string;
}

/**
 * Compact chips listing which fields matched a full-text query.
 */
export function MatchFieldBadges({ matches, className }: MatchFieldBadgesProps) {
  if (matches.length === 0) {
    return null;
  }

  return (
    <div className={cn("flex flex-wrap gap-1", className)}>
      {matches.map((field) => (
        <span
          key={field}
          className="rounded-[3px] border border-signal-orange/30 bg-signal-orange/10 px-1.5 py-0.5 text-[10px] tracking-wide text-signal-orange uppercase"
        >
          {SEARCH_FIELD_LABELS[field] ?? field}
        </span>
      ))}
    </div>
  );
}
