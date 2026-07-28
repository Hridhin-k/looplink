"use client";

import { ErrorFallback } from "@/components/error-fallback";

import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="min-h-full bg-background text-foreground antialiased">
        <ErrorFallback error={error} reset={reset} title="Application error" />
      </body>
    </html>
  );
}
