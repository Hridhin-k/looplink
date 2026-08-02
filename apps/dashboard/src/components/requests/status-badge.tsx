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
        className="rounded-sm font-mono text-[11px] text-smoke"
      >
        —
      </Badge>
    );
  }

  const bucket = Math.floor(status / 100);
  const tone =
    bucket === 2
      ? "border-success-green/35 bg-success-green/10 text-success-green"
      : bucket === 3
        ? "border-ash/40 bg-ink text-ash"
        : bucket === 4
          ? "border-coral-pulse/40 bg-ember-hush text-coral-pulse"
          : bucket === 5
            ? "border-coral-pulse/50 bg-ember-hush text-coral-pulse"
            : "border-slate bg-ink text-smoke";

  return (
    <Badge variant="outline" className={cn("rounded-sm font-mono text-[11px]", tone)}>
      {status}
    </Badge>
  );
}
