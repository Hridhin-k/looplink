"use client";

import { motion } from "framer-motion";

/**
 * Empty overview placeholder — no inspector data wired yet.
 */
export function OverviewEmpty() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      className="flex min-h-[min(28rem,60vh)] flex-col items-start justify-center gap-3"
    >
      <p className="text-sm tracking-[0.18em] text-muted-foreground uppercase">Overview</p>
      <h2 className="max-w-lg font-heading text-3xl tracking-tight sm:text-4xl">
        Nothing to inspect yet
      </h2>
      <p className="max-w-md text-muted-foreground">
        Request traffic, tunnels, and statistics will show up here once the inspector views are
        connected.
      </p>
    </motion.div>
  );
}
