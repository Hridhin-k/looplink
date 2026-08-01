import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * HTTP status chip (or pending when response not recorded).
 */
export function StatusBadge({ status }: { readonly status?: number }) {
  if (status === undefined) {
    return (
      <Badge
        variant="outline"
        className="rounded-[3px] font-mono text-[11px] text-warm-granite"
      >
        —
      </Badge>
    );
  }

  const bucket = Math.floor(status / 100);
  const tone =
    bucket === 2
      ? "border-metric-green/35 bg-metric-green/10 text-metric-green"
      : bucket === 3
        ? "border-pale-stone/40 bg-carbon-lift text-pale-stone"
        : bucket === 4
          ? "border-signal-orange/40 bg-signal-orange/10 text-signal-orange"
          : bucket === 5
            ? "border-signal-orange/50 bg-signal-orange/15 text-signal-orange"
            : "border-ash-stroke bg-carbon-lift text-warm-granite";

  return (
    <Badge variant="outline" className={cn("rounded-[3px] font-mono text-[11px]", tone)}>
      {status}
    </Badge>
  );
}
