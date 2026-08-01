"use client";

import { motion, useReducedMotion } from "framer-motion";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { pageEnter, reducedEnter } from "@/lib/motion";

/**
 * Subtle route enter for dashboard main content.
 * Keyed by pathname so back/forward navigations re-trigger once.
 */
export function PageEnter({ children }: { readonly children: ReactNode }) {
  const pathname = usePathname();
  const reduce = useReducedMotion();
  const variants = reduce ? reducedEnter : pageEnter;

  return (
    <motion.div
      key={pathname}
      initial={variants.initial}
      animate={variants.animate}
      transition={variants.transition}
    >
      {children}
    </motion.div>
  );
}
