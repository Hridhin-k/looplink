import { Skeleton } from "@/components/ui/skeleton";

/**
 * Content-area loading skeleton (shell chrome stays mounted via layout).
 */
export function LoadingFallback() {
  return (
    <div className="space-y-4 py-2">
      <Skeleton className="h-4 w-24" />
      <Skeleton className="h-10 w-72 max-w-full" />
      <Skeleton className="h-4 w-full max-w-md" />
      <div className="grid gap-3 pt-6 sm:grid-cols-2 lg:grid-cols-3">
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl" />
        <Skeleton className="h-28 w-full rounded-xl sm:col-span-2 lg:col-span-1" />
      </div>
    </div>
  );
}
