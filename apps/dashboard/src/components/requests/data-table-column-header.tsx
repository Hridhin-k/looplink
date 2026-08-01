import { ArrowDownIcon, ArrowUpIcon, ArrowUpDownIcon } from "lucide-react";
import type { Column } from "@tanstack/react-table";
import type { ReactNode } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface DataTableColumnHeaderProps<TData, TValue> {
  readonly column: Column<TData, TValue>;
  readonly title: string;
  readonly className?: string;
}

/**
 * Sortable column header button for TanStack Table.
 */
export function DataTableColumnHeader<TData, TValue>({
  column,
  title,
  className,
}: DataTableColumnHeaderProps<TData, TValue>): ReactNode {
  if (!column.getCanSort()) {
    return <div className={cn(className)}>{title}</div>;
  }

  const sorted = column.getIsSorted();

  return (
    <Button
      type="button"
      variant="ghost"
      size="sm"
      className={cn("-ml-2 h-8 gap-1 px-2 font-normal text-caption text-pale-stone hover:text-bone", className)}
      onClick={() => column.toggleSorting(sorted === "asc")}
    >
      <span>{title}</span>
      {sorted === "desc" ? (
        <ArrowDownIcon className="size-3.5 opacity-70" />
      ) : sorted === "asc" ? (
        <ArrowUpIcon className="size-3.5 opacity-70" />
      ) : (
        <ArrowUpDownIcon className="size-3.5 opacity-40" />
      )}
    </Button>
  );
}
