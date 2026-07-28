"use client";

import { Suspense, use } from "react";

import { RequestDetails } from "@/components/requests/request-details";
import { Skeleton } from "@/components/ui/skeleton";

export default function RequestDetailsPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  return (
    <Suspense
      fallback={
        <div className="space-y-4">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-72 w-full rounded-xl" />
        </div>
      }
    >
      <RequestDetails requestId={decodeURIComponent(id)} />
    </Suspense>
  );
}
