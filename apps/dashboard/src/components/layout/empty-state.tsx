"use client";

import { motion, useReducedMotion } from "framer-motion";
import type { ReactNode } from "react";

import { emptyEnter, reducedEnter } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  readonly eyebrow?: string;
  readonly title: string;
  readonly description: ReactNode;
  readonly actions?: ReactNode;
  readonly footer?: ReactNode;
  readonly className?: string;
  readonly compact?: boolean;
}

/**
 * Empty / zero-traffic state for Mission Control surfaces.
 * Soft enter + optional idle float on the decorative mark.
 */
export function EmptyState({
  eyebrow = "Getting started",
  title,
  description,
  actions,
  footer,
  className,
  compact = false,
}: EmptyStateProps) {
  const reduce = useReducedMotion();
  const variants = reduce ? reducedEnter : emptyEnter;

  return (
    <motion.div
      initial={variants.initial}
      animate={variants.animate}
      transition={variants.transition}
      className={cn(
        "rounded-[10px] border border-ash-stroke bg-transparent shadow-panel",
        compact ? "px-5 py-8" : "px-6 py-10 sm:px-8 sm:py-12",
        className,
      )}
    >
      <div
        className={cn(
          "mb-5 flex size-9 items-center justify-center rounded-[3px] border border-ash-stroke bg-carbon-lift",
          !reduce && "animate-mc-empty-float",
        )}
        aria-hidden
      >
        <span className="size-1.5 rounded-full bg-signal-orange/80" />
      </div>
      <p className="text-caption text-pale-stone">{eyebrow}</p>
      <h2
        className={cn(
          "mt-3 max-w-lg text-bone",
          compact
            ? "text-xl tracking-tight"
            : "text-[28px] leading-[1.15] tracking-[-0.04em] sm:text-[36px] sm:leading-[1.1] sm:tracking-[-1.12px]",
        )}
      >
        {title}
      </h2>
      <div className="mt-3 max-w-md text-sm leading-normal text-warm-granite">{description}</div>
      {actions !== undefined ? (
        <div className="mt-6 flex flex-wrap gap-3">{actions}</div>
      ) : null}
      {footer !== undefined ? <div className="mt-6">{footer}</div> : null}
    </motion.div>
  );
}
