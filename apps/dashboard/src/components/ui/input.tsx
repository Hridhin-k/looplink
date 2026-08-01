import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-[3px] border border-ash-stroke bg-obsidian-canvas px-2.5 py-1 text-sm text-bone transition-machine outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-normal file:text-bone placeholder:text-warm-granite focus-visible:border-pale-stone focus-visible:ring-1 focus-visible:ring-pale-stone/30 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:border-signal-orange aria-invalid:ring-1 aria-invalid:ring-signal-orange/30",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
