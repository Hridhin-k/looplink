import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/** Lumen method tones — monochrome + functional accents only. */
const METHOD_STYLES: Record<string, string> = {
  GET: "border-slate bg-void-black text-pure-white",
  POST: "border-success-green/35 bg-success-green/10 text-success-green",
  PUT: "border-ash/40 bg-ink text-ash",
  PATCH: "border-coral-pulse/35 bg-ember-hush text-coral-pulse",
  DELETE: "border-coral-pulse/50 bg-ember-hush text-coral-pulse",
  HEAD: "border-slate bg-transparent text-smoke",
  OPTIONS: "border-slate bg-transparent text-smoke",
};

/**
 * HTTP method chip.
 */
export function MethodBadge({ method }: { readonly method: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-sm font-mono text-[11px] tracking-wide uppercase",
        METHOD_STYLES[method.toUpperCase()] ?? "border-slate bg-ink text-pure-white",
      )}
    >
      {method}
    </Badge>
  );
}
