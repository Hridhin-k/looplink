"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Compact KPI tile for overview and statistics.
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
    <Card size="sm" className={cn("min-w-0 shadow-none", className)}>
      <CardHeader className="gap-1 p-5">
        <CardDescription className="font-mono text-[12px] tracking-[-0.24px] text-pale-stone uppercase">
          {label}
        </CardDescription>
        <CardTitle className="text-[36px] leading-[1.1] font-normal tracking-[-1.12px] text-bone tabular-nums">
          {value}
        </CardTitle>
      </CardHeader>
      {hint !== undefined ? (
        <CardContent className="pt-0 pb-5">
          <p className="text-xs text-warm-granite">{hint}</p>
        </CardContent>
      ) : null}
    </Card>
  );
}
