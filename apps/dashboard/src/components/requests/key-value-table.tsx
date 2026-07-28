import type { KeyValueEntry } from "@/lib/request-body";
import { cn } from "@/lib/utils";
import { HighlightText } from "@/components/requests/highlight-text";

interface KeyValueTableProps {
  readonly entries: readonly KeyValueEntry[];
  readonly emptyLabel?: string;
  readonly className?: string;
  readonly highlightQuery?: string;
}

/**
 * Two-column key/value list for headers, cookies, and query params.
 */
export function KeyValueTable({
  entries,
  emptyLabel = "None",
  className,
  highlightQuery = "",
}: KeyValueTableProps) {
  if (entries.length === 0) {
    return (
      <div
        className={cn(
          "rounded-lg border border-dashed border-border/80 px-3 py-8 text-center text-sm text-muted-foreground",
          className,
        )}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div className={cn("overflow-hidden rounded-lg border border-border/80", className)}>
      <table className="w-full text-left text-sm">
        <tbody>
          {entries.map((entry, index) => (
            <tr
              key={`${entry.key}-${String(index)}`}
              className="border-b border-border/60 last:border-b-0"
            >
              <th className="w-[32%] max-w-[14rem] bg-muted/30 px-3 py-2 align-top font-mono text-xs font-medium text-muted-foreground break-all">
                <HighlightText text={entry.key} query={highlightQuery} />
              </th>
              <td className="px-3 py-2 align-top font-mono text-xs break-all whitespace-pre-wrap">
                {entry.value.length > 0 ? (
                  <HighlightText text={entry.value} query={highlightQuery} />
                ) : (
                  <span className="text-muted-foreground">—</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
