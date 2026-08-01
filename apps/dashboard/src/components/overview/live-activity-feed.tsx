"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";

import { ActivityEventCard } from "@/components/overview/activity-event-card";
import { LiveMeta } from "@/components/layout/surface";
import type { InspectorRequestSummary } from "@/lib/api";
import { listItemEnter } from "@/lib/motion";
import { useConnectionStore } from "@/stores/connection-store";

interface LiveActivityFeedProps {
  readonly events: readonly InspectorRequestSummary[];
  readonly workspaceName: string;
}

/**
 * Large live activity stream — new events slide in; completions update in place.
 */
export function LiveActivityFeed({ events, workspaceName }: LiveActivityFeedProps) {
  const live = useConnectionStore((s) => s.status) === "connected";

  return (
    <section className="space-y-4" aria-label="Live activity">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-caption text-pale-stone">Live activity</p>
          <h2 className="mt-1.5 text-xl tracking-tight text-bone sm:text-2xl">
            What is happening right now
          </h2>
          <p className="mt-1 text-sm text-warm-granite">
            {events.length} recent {events.length === 1 ? "event" : "events"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <LiveMeta live={live} liveLabel="Streaming" idleLabel="Paused" />
          <Link
            href="/requests"
            className="inline-flex h-7 items-center rounded-[3px] border border-ash-stroke px-2.5 text-xs text-bone transition-machine hover:border-pale-stone hover:bg-carbon-lift"
          >
            Full explorer
          </Link>
        </div>
      </div>

      <ul className="flex flex-col gap-3">
        <AnimatePresence initial={false} mode="popLayout">
          {events.map((event) => (
            <motion.li
              key={event.id}
              layout
              initial={listItemEnter.initial}
              animate={listItemEnter.animate}
              exit={listItemEnter.exit}
              transition={listItemEnter.transition}
            >
              <ActivityEventCard event={event} workspaceName={workspaceName} />
            </motion.li>
          ))}
        </AnimatePresence>
      </ul>
    </section>
  );
}
