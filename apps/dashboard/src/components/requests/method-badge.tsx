import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Factory-constrained method tones — monochrome + functional accents only. */
const METHOD_STYLES: Record<string, string> = {
  GET: "border-ash-stroke bg-obsidian-canvas text-bone",
  POST: "border-metric-green/35 bg-metric-green/10 text-metric-green",
  PUT: "border-pale-stone/40 bg-carbon-lift text-pale-stone",
  PATCH: "border-signal-orange/35 bg-signal-orange/10 text-signal-orange",
  DELETE: "border-signal-orange/50 bg-signal-orange/15 text-signal-orange",
  HEAD: "border-ash-stroke bg-transparent text-warm-granite",
  OPTIONS: "border-ash-stroke bg-transparent text-warm-granite",
};

/**
 * HTTP method chip.
 */
export function MethodBadge({ method }: { readonly method: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-[3px] font-mono text-[11px] tracking-wide uppercase",
        METHOD_STYLES[method.toUpperCase()] ?? "border-ash-stroke bg-carbon-lift text-bone",
      )}
    >
      {method}
    </Badge>
  );
}
