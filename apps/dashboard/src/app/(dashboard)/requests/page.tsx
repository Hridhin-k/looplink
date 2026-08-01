import { Suspense } from "react";

import { RequestExplorer } from "@/components/requests/request-explorer";
import { Skeleton } from "@/components/ui/skeleton";

export default function RequestsPage() {
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-24 w-full" />
          <Skeleton className="h-24 w-full" />
        </div>
      }
    >
      <RequestExplorer />
    </Suspense>
  );
}
