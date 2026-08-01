import { Skeleton } from "@/components/ui/skeleton";

/**
 * Content-area loading skeleton (shell chrome stays mounted via layout).
 */
export function LoadingFallback() {
  return (
    <div className="space-y-8 py-1">
      <div className="space-y-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-9 w-64 max-w-full" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <div className="grid overflow-hidden rounded-[10px] border border-ash-stroke sm:grid-cols-2 xl:grid-cols-4">
        {Array.from({ length: 4 }, (_, index) => (
          <div key={index} className="space-y-3 border-b border-r border-ash-stroke p-5">
            <Skeleton className="h-3 w-16" />
            <Skeleton className="h-9 w-24" />
            <Skeleton className="h-3 w-20" />
          </div>
        ))}
      </div>
      <Skeleton className="h-72 w-full rounded-[10px]" />
    </div>
  );
}
