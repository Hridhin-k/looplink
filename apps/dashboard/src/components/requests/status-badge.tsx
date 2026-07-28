import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * HTTP status chip (or pending when response not recorded).
 */
export function StatusBadge({ status }: { readonly status?: number }) {
  if (status === undefined) {
    return (
      <Badge variant="outline" className="rounded-md font-mono text-[11px] text-muted-foreground">
        —
      </Badge>
    );
  }

  const bucket = Math.floor(status / 100);
  const tone =
    bucket === 2
      ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300"
      : bucket === 3
        ? "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300"
        : bucket === 4
          ? "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300"
          : bucket === 5
            ? "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300"
            : "border-border bg-muted text-muted-foreground";

  return (
    <Badge variant="outline" className={cn("rounded-md font-mono text-[11px]", tone)}>
      {status}
    </Badge>
  );
}
