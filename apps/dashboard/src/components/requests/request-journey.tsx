"use client";

import { CheckIcon } from "lucide-react";
import { motion } from "framer-motion";

import {
  buildRequestJourney,
  buildRequestTimeline,
  formatTimelineDuration,
  type JourneyStep,
  type JourneyStepId,
} from "@/lib/request-timeline";
import { cn } from "@/lib/utils";

const STEP_TONE: Record<JourneyStepId, string> = {
  browser: "bg-pale-stone",
  tunnel: "bg-graphite-mid",
  badger: "bg-signal-orange",
  application: "bg-metric-green",
  response: "bg-bone",
  complete: "bg-metric-green",
};

interface RequestJourneyProps {
  readonly timestamp: number;
  readonly latencyMs?: number;
  /** When true, pulse the active hop (e.g. during replay). */
  readonly replaying?: boolean;
  readonly className?: string;
}

/**
 * Animated lifecycle journey: Browser → Tunnel → Badger → Application → Response → Complete.
 */
export function RequestJourney({
  timestamp,
  latencyMs,
  replaying = false,
  className,
}: RequestJourneyProps) {
  const model = buildRequestTimeline({ timestamp, latencyMs });
  const steps = buildRequestJourney(model);

  return (
    <section
      className={cn(
        "overflow-hidden rounded-[10px] border border-ash-stroke bg-carbon-lift shadow-panel",
        className,
      )}
      aria-label="Request journey"
    >
      <header className="flex flex-wrap items-center justify-between gap-3 border-b border-ash-stroke px-4 py-3 sm:px-5">
        <div>
          <p className="text-caption text-pale-stone">Journey</p>
          <p className="mt-1 text-sm text-warm-granite">
            {model.completed
              ? `Completed in ${formatTimelineDuration(model.totalMs)}`
              : "Lifecycle in progress"}
          </p>
        </div>
        {replaying ? (
          <span className="inline-flex items-center gap-1.5 text-caption text-signal-orange">
            <span className="size-1.5 animate-mc-live rounded-full bg-signal-orange" aria-hidden />
            Replaying
          </span>
        ) : null}
      </header>

      <ol className="flex flex-col gap-0 px-3 py-4 sm:flex-row sm:items-stretch sm:gap-0 sm:overflow-x-auto sm:px-4 sm:py-5">
        {steps.map((step, index) => (
          <JourneyNode
            key={step.id}
            step={step}
            index={index}
            isLast={index === steps.length - 1}
            replaying={replaying}
          />
        ))}
      </ol>
    </section>
  );
}

function JourneyNode({
  step,
  index,
  isLast,
  replaying,
}: {
  readonly step: JourneyStep;
  readonly index: number;
  readonly isLast: boolean;
  readonly replaying: boolean;
}) {
  const active = step.state === "active" || (replaying && step.state !== "complete" && index === 0);

  return (
    <li className="relative flex min-w-0 flex-1 gap-3 sm:flex-col sm:items-center sm:gap-2 sm:px-1">
      <div className="flex items-center sm:w-full">
        <motion.div
          initial={{ scale: 0.92, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: index * 0.05, duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
          className={cn(
            "relative z-10 flex size-8 shrink-0 items-center justify-center rounded-full border transition-machine",
            step.state === "complete" && "border-metric-green/50 bg-metric-green/15 text-metric-green",
            step.state === "active" && "border-signal-orange bg-signal-orange/15 text-signal-orange",
            step.state === "pending" && "border-ash-stroke bg-obsidian-canvas text-warm-granite",
            active && replaying && "animate-mc-live",
          )}
        >
          {step.state === "complete" ? (
            <CheckIcon className="size-3.5" />
          ) : (
            <span className={cn("size-2 rounded-full", STEP_TONE[step.id])} aria-hidden />
          )}
        </motion.div>

        {!isLast ? (
          <div className="mx-2 hidden h-px flex-1 bg-ash-stroke sm:block" aria-hidden>
            <motion.div
              className="h-full origin-left bg-metric-green/70"
              initial={{ scaleX: 0 }}
              animate={{ scaleX: step.state === "complete" ? 1 : 0 }}
              transition={{ delay: index * 0.06 + 0.12, duration: 0.35, ease: [0.4, 0, 0.2, 1] }}
            />
          </div>
        ) : null}
      </div>

      {!isLast ? (
        <div className="absolute top-8 bottom-0 left-[0.95rem] w-px bg-ash-stroke sm:hidden" aria-hidden />
      ) : null}

      <div className="min-w-0 flex-1 pb-4 sm:pb-0 sm:text-center">
        <p
          className={cn(
            "text-sm tracking-tight",
            step.state === "pending" ? "text-warm-granite" : "text-bone",
          )}
        >
          {step.label}
        </p>
        <p className="mt-0.5 hidden text-[11px] leading-snug text-warm-granite sm:line-clamp-2 lg:block">
          {step.description}
        </p>
        {step.durationMs !== undefined && step.id !== "complete" ? (
          <p className="mt-1 font-mono text-[10px] text-pale-stone tabular-nums">
            {formatTimelineDuration(step.durationMs)}
          </p>
        ) : null}
      </div>
    </li>
  );
}
