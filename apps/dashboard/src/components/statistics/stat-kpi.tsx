"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Compact KPI tile for the statistics overview.
 */
export function StatKpi({
  label,
  value,
  hint,
  className,
}: {
  readonly label: string;
  readonly value: string;
  readonly hint?: string;
  readonly className?: string;
}) {
  return (
    <Card size="sm" className={cn("min-w-0", className)}>
      <CardHeader className="gap-0.5">
        <CardDescription className="text-[11px] tracking-[0.14em] uppercase">
          {label}
        </CardDescription>
        <CardTitle className="font-mono text-2xl tracking-tight tabular-nums">{value}</CardTitle>
      </CardHeader>
      {hint !== undefined ? (
        <CardContent>
          <p className="text-xs text-muted-foreground">{hint}</p>
        </CardContent>
      ) : null}
    </Card>
  );
}
