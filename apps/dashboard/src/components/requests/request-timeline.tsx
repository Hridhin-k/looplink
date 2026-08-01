"use client";

import { motion } from "framer-motion";

import { Badge } from "@/components/ui/badge";
import {
  buildRequestTimeline,
  formatTimelineDuration,
  type RequestTimelinePhaseId,
  type RequestTimelineSpan,
} from "@/lib/request-timeline";
import { cn } from "@/lib/utils";

const PHASE_BAR_CLASS: Record<RequestTimelinePhaseId, string> = {
  browser: "bg-pale-stone",
  tunnel: "bg-graphite-mid",
  badger: "bg-signal-orange",
  application: "bg-metric-green",
  response: "bg-bone/80",
};

interface RequestTimelineProps {
  readonly timestamp: number;
  readonly latencyMs?: number;
  readonly className?: string;
}

/**
 * Chrome DevTools–style Timing waterfall for a single exchange.
 */
export function RequestTimeline({ timestamp, latencyMs, className }: RequestTimelineProps) {
  const model = buildRequestTimeline({ timestamp, latencyMs });
  const scaleMs = Math.max(model.totalMs, 1);

  return (
    <section
      className={cn(
        "overflow-hidden rounded-[10px] border border-ash-stroke bg-carbon-lift shadow-panel",
        className,
      )}
      aria-label="Request timing waterfall"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-ash-stroke px-4 py-3 sm:px-5">
        <div className="min-w-0">
          <p className="text-caption text-pale-stone">Waterfall</p>
          <p className="mt-1 text-sm text-warm-granite">
            {model.completed
              ? `Total ${formatTimelineDuration(model.totalMs)}`
              : "Waiting for response"}
            {" · "}
            started {new Date(model.startedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {model.estimated ? (
            <Badge variant="outline" className="rounded-[3px] text-[10px] tracking-wide uppercase">
              Estimated
            </Badge>
          ) : null}
          <span className="font-mono text-xs text-bone tabular-nums">
            {model.completed ? formatTimelineDuration(model.totalMs) : "—"}
          </span>
        </div>
      </header>

      <div className="px-4 pt-4 pb-3 sm:px-5">
        <div className="mb-2 flex justify-between font-mono text-[10px] text-warm-granite">
          {model.ticks.map((tick, index) => (
            <span key={`${String(tick)}-${String(index)}`} className="tabular-nums">
              {formatTimelineDuration(tick)}
            </span>
          ))}
        </div>

        <div className="relative mb-5 h-3 overflow-hidden rounded-[3px] bg-obsidian-canvas">
          {model.completed ? (
            <div className="absolute inset-y-0 left-0 flex w-full">
              {model.spans.map((span) => (
                <motion.div
                  key={`summary-${span.id}`}
                  className={cn("h-full", PHASE_BAR_CLASS[span.id])}
                  style={{ width: `${(span.durationMs / scaleMs) * 100}%` }}
                  title={`${span.label}: ${formatTimelineDuration(span.durationMs)}`}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ duration: 0.3 }}
                />
              ))}
            </div>
          ) : (
            <motion.div
              className="absolute inset-y-0 left-0 w-1/3 bg-signal-orange/40"
              animate={{ x: ["0%", "200%"] }}
              transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
            />
          )}
        </div>

        <div className="flex flex-col gap-2.5 pb-3">
          {model.spans.map((span, index) => (
            <TimelineRow key={span.id} span={span} scaleMs={scaleMs} index={index} />
          ))}
        </div>

        <legend className="flex flex-wrap gap-x-4 gap-y-1.5 border-t border-ash-stroke pt-3 pb-1 text-[11px] text-warm-granite">
          {model.spans.map((span) => (
            <span key={`legend-${span.id}`} className="inline-flex items-center gap-1.5">
              <span className={cn("size-2 rounded-[2px]", PHASE_BAR_CLASS[span.id])} aria-hidden />
              {span.label}
            </span>
          ))}
        </legend>
      </div>
    </section>
  );
}

function TimelineRow({
  span,
  scaleMs,
  index,
}: {
  readonly span: RequestTimelineSpan;
  readonly scaleMs: number;
  readonly index: number;
}) {
  const left = (span.startMs / scaleMs) * 100;
  const width = span.pending
    ? 0
    : Math.max(span.durationMs <= 0 ? 0.4 : (span.durationMs / scaleMs) * 100, 0.4);

  return (
    <div className="grid grid-cols-[6.5rem_minmax(0,1fr)_4.5rem] items-center gap-2 sm:grid-cols-[8.5rem_minmax(0,1fr)_5rem]">
      <div className="min-w-0">
        <p className="truncate text-xs text-bone">{span.label}</p>
        <p className="truncate text-[10px] text-warm-granite sm:hidden">{span.description}</p>
      </div>

      <div
        className="relative h-6 overflow-hidden rounded-[3px] bg-obsidian-canvas"
        title={`${span.description} · ${
          span.pending ? "pending" : formatTimelineDuration(span.durationMs)
        }`}
      >
        <div className="pointer-events-none absolute inset-0 flex justify-between">
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} className="h-full w-px bg-ash-stroke/40" aria-hidden />
          ))}
        </div>

        {span.pending ? (
          <div className="absolute inset-y-1.5 left-0 flex w-full items-center px-2">
            <span className="h-1 w-full rounded-full border border-dashed border-ash-stroke" />
          </div>
        ) : (
          <motion.div
            className={cn(
              "absolute top-1.5 bottom-1.5 rounded-[2px]",
              PHASE_BAR_CLASS[span.id],
              span.durationMs <= 0 && "min-w-0.5",
            )}
            initial={{ opacity: 0, scaleX: 0.15 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ delay: index * 0.05, duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
            style={{
              left: `${String(left)}%`,
              width: `${String(width)}%`,
              transformOrigin: "left center",
            }}
          />
        )}
      </div>

      <p className="text-right font-mono text-[11px] text-warm-granite tabular-nums">
        {span.pending ? "pending" : formatTimelineDuration(span.durationMs)}
      </p>
    </div>
  );
}
