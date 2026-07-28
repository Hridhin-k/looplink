"use client";

import type { ReactNode } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * Chart / distribution panel shell.
 */
export function ChartPanel({
  title,
  description,
  children,
  className,
  empty,
}: {
  readonly title: string;
  readonly description?: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly empty?: boolean;
}) {
  return (
    <Card className={cn("min-w-0", className)}>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description !== undefined ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent>
        {empty ? (
          <div className="flex h-56 items-center justify-center rounded-lg border border-dashed border-border/80">
            <p className="text-sm text-muted-foreground">No data in this window yet</p>
          </div>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}
