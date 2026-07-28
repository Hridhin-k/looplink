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
  received: "bg-zinc-500 dark:bg-zinc-400",
  tunnel: "bg-teal-600 dark:bg-teal-400",
  forward: "bg-amber-600 dark:bg-amber-400",
  application: "bg-emerald-600 dark:bg-emerald-400",
  response: "bg-sky-600 dark:bg-sky-400",
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
      className={cn("overflow-hidden rounded-xl border border-border/80 bg-background", className)}
      aria-label="Request timing"
    >
      <header className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 px-4 py-3">
        <div className="min-w-0">
          <p className="text-sm font-medium">Timing</p>
          <p className="text-xs text-muted-foreground">
            {model.completed
              ? `Total ${formatTimelineDuration(model.totalMs)}`
              : "Waiting for response"}
            {" · "}
            started {new Date(model.startedAt).toLocaleString()}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {model.estimated ? (
            <Badge variant="outline" className="rounded-md text-[10px] tracking-wide uppercase">
              Estimated
            </Badge>
          ) : null}
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {model.completed ? formatTimelineDuration(model.totalMs) : "—"}
          </span>
        </div>
      </header>

      <div className="px-4 pt-3 pb-2">
        <div className="mb-2 flex justify-between font-mono text-[10px] text-muted-foreground">
          {model.ticks.map((tick, index) => (
            <span key={`${String(tick)}-${String(index)}`} className="tabular-nums">
              {formatTimelineDuration(tick)}
            </span>
          ))}
        </div>

        {/* Aggregate latency bar (DevTools summary strip) */}
        <div className="relative mb-4 h-3 overflow-hidden rounded-sm bg-muted/70">
          {model.completed ? (
            <div className="absolute inset-y-0 left-0 flex w-full">
              {model.spans.map((span) => (
                <div
                  key={`summary-${span.id}`}
                  className={cn("h-full", PHASE_BAR_CLASS[span.id])}
                  style={{ width: `${(span.durationMs / scaleMs) * 100}%` }}
                  title={`${span.label}: ${formatTimelineDuration(span.durationMs)}`}
                />
              ))}
            </div>
          ) : (
            <motion.div
              className="absolute inset-y-0 left-0 w-1/3 bg-amber-500/50"
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

        <legend className="flex flex-wrap gap-x-3 gap-y-1 border-t border-border/60 pt-3 pb-1 text-[11px] text-muted-foreground">
          {model.spans.map((span) => (
            <span key={`legend-${span.id}`} className="inline-flex items-center gap-1.5">
              <span className={cn("size-2 rounded-sm", PHASE_BAR_CLASS[span.id])} aria-hidden />
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
    <div className="grid grid-cols-[7.5rem_minmax(0,1fr)_4.5rem] items-center gap-2 sm:grid-cols-[9rem_minmax(0,1fr)_5rem]">
      <div className="min-w-0">
        <p className="truncate text-xs font-medium">{span.label}</p>
        <p className="truncate text-[10px] text-muted-foreground sm:hidden">{span.description}</p>
      </div>

      <div
        className="relative h-5 overflow-hidden rounded-sm bg-muted/50"
        title={`${span.description} · ${
          span.pending ? "pending" : formatTimelineDuration(span.durationMs)
        }`}
      >
        {/* Vertical guide lines */}
        <div className="pointer-events-none absolute inset-0 flex justify-between px-0">
          {Array.from({ length: 5 }, (_, i) => (
            <span key={i} className="h-full w-px bg-border/50" aria-hidden />
          ))}
        </div>

        {span.pending ? (
          <div className="absolute inset-y-1 left-0 flex w-full items-center px-2">
            <span className="h-1 w-full rounded-full border border-dashed border-muted-foreground/40" />
          </div>
        ) : (
          <motion.div
            className={cn(
              "absolute top-1 bottom-1 rounded-[2px]",
              PHASE_BAR_CLASS[span.id],
              span.durationMs <= 0 && "min-w-0.5",
            )}
            initial={{ opacity: 0, scaleX: 0.2 }}
            animate={{ opacity: 1, scaleX: 1 }}
            transition={{ delay: index * 0.04, duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
            style={{
              left: `${String(left)}%`,
              width: `${String(width)}%`,
              transformOrigin: "left center",
            }}
          />
        )}
      </div>

      <p className="text-right font-mono text-[11px] tabular-nums text-muted-foreground">
        {span.pending ? "pending" : formatTimelineDuration(span.durationMs)}
      </p>
    </div>
  );
}
