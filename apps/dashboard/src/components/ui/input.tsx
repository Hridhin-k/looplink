import * as React from "react";
import { Input as InputPrimitive } from "@base-ui/react/input";

import { cn } from "@/lib/utils";

function Input({ className, type, ...props }: React.ComponentProps<"input">) {
  return (
    <InputPrimitive
      type={type}
      data-slot="input"
      className={cn(
        "h-8 w-full min-w-0 rounded-md border-0 bg-white/5 px-3 py-2 text-base text-pure-white shadow-hairline transition-machine outline-none file:inline-flex file:h-6 file:border-0 file:bg-transparent file:text-sm file:font-normal file:text-pure-white placeholder:text-ash focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color-mix(in_oklab,var(--coral-pulse)_55%,transparent)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 aria-invalid:outline-coral-pulse",
        className,
      )}
      {...props}
    />
  );
}

export { Input };
