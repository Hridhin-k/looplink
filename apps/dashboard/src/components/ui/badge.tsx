import { mergeProps } from "@base-ui/react/merge-props";
import { useRender } from "@base-ui/react/use-render";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-sm border border-transparent px-1.5 py-0.5 font-mono text-[12px] font-normal whitespace-nowrap transition-machine focus-visible:outline focus-visible:outline-1 focus-visible:outline-[color-mix(in_oklab,var(--coral-pulse)_55%,transparent)] has-data-[icon=inline-end]:pr-1 has-data-[icon=inline-start]:pl-1 aria-invalid:border-coral-pulse [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-graphite text-pure-white [a]:hover:bg-obsidian",
        secondary: "bg-obsidian text-pure-white border-slate [a]:hover:bg-graphite",
        destructive:
          "border-coral-pulse/40 bg-ember-hush text-coral-pulse [a]:hover:bg-coral-pulse/20",
        outline:
          "border-slate text-ash [a]:hover:border-ash [a]:hover:text-pure-white",
        ghost: "text-smoke hover:bg-obsidian hover:text-pure-white",
        link: "text-pure-white underline-offset-4 hover:underline",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

function Badge({
  className,
  variant = "default",
  render,
  ...props
}: useRender.ComponentProps<"span"> & VariantProps<typeof badgeVariants>) {
  return useRender({
    defaultTagName: "span",
    props: mergeProps<"span">(
      {
        className: cn(badgeVariants({ variant }), className),
      },
      props,
    ),
    render,
    state: {
      slot: "badge",
      variant,
    },
  });
}

export { Badge, badgeVariants };
