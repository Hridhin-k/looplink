import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const METHOD_STYLES: Record<string, string> = {
  GET: "border-sky-500/30 bg-sky-500/10 text-sky-700 dark:text-sky-300",
  POST: "border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
  PUT: "border-amber-500/30 bg-amber-500/10 text-amber-800 dark:text-amber-300",
  PATCH: "border-orange-500/30 bg-orange-500/10 text-orange-800 dark:text-orange-300",
  DELETE: "border-red-500/30 bg-red-500/10 text-red-700 dark:text-red-300",
  HEAD: "border-border bg-muted text-muted-foreground",
  OPTIONS: "border-border bg-muted text-muted-foreground",
};

/**
 * HTTP method chip.
 */
export function MethodBadge({ method }: { readonly method: string }) {
  return (
    <Badge
      variant="outline"
      className={cn(
        "rounded-md font-mono text-[11px] tracking-wide uppercase",
        METHOD_STYLES[method.toUpperCase()] ?? "border-border bg-muted text-foreground",
      )}
    >
      {method}
    </Badge>
  );
}
