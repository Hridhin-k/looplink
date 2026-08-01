import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

interface PageHeaderProps {
  readonly eyebrow?: string;
  readonly title: ReactNode;
  readonly description?: ReactNode;
  readonly meta?: ReactNode;
  readonly actions?: ReactNode;
  readonly className?: string;
}

/**
 * Mission Control page header — mono eyebrow, display title, optional meta/actions.
 */
export function PageHeader({
  eyebrow,
  title,
  description,
  meta,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0 space-y-2">
        {eyebrow !== undefined ? (
          <p className="text-caption text-pale-stone">{eyebrow}</p>
        ) : null}
        <h1 className="text-heading-page truncate text-bone">{title}</h1>
        {description !== undefined ? (
          <div className="max-w-xl text-sm leading-normal text-warm-granite">{description}</div>
        ) : null}
      </div>

      {(meta !== undefined || actions !== undefined) ? (
        <div className="flex shrink-0 flex-wrap items-center gap-3">
          {meta}
          {actions}
        </div>
      ) : null}
    </header>
  );
}
