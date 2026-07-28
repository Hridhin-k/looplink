"use client";

import { AlertCircleIcon, RefreshCwIcon } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

interface ErrorFallbackProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
  readonly title?: string;
}

/**
 * Shared error UI for route `error.tsx` and `global-error.tsx`.
 */
export function ErrorFallback({
  error,
  reset,
  title = "Something went wrong",
}: ErrorFallbackProps) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-6 px-6 py-16">
      <Alert variant="destructive" className="max-w-lg">
        <AlertCircleIcon />
        <AlertTitle>{title}</AlertTitle>
        <AlertDescription>
          <p className="mt-1 font-mono text-xs break-words opacity-90">
            {error.message || "Unexpected error"}
          </p>
          {error.digest ? (
            <p className="mt-2 font-mono text-[10px] opacity-60">Digest: {error.digest}</p>
          ) : null}
        </AlertDescription>
      </Alert>
      <Button type="button" onClick={reset}>
        <RefreshCwIcon className="size-4" />
        Try again
      </Button>
    </div>
  );
}
