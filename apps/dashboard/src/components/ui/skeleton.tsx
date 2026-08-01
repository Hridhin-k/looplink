import type { ComponentProps } from "react";

import { cn } from "@/lib/utils";

function Skeleton({ className, ...props }: ComponentProps<"div">) {
  return (
    <div
      data-slot="skeleton"
      className={cn("animate-mc-shimmer rounded-[3px] bg-carbon-lift", className)}
      {...props}
    />
  );
}

export { Skeleton };
