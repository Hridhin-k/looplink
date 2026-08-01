"use client";

import Link from "next/link";
import {
  ChevronDownIcon,
  Loader2Icon,
  RotateCcwIcon,
  ScanSearchIcon,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useId, type KeyboardEvent, type ReactNode } from "react";

import { HighlightText, MatchFieldBadges } from "@/components/requests/highlight-text";
import { LatencyBar } from "@/components/requests/latency-bar";
import { MethodBadge } from "@/components/requests/method-badge";
import {
  formatClock,
  formatLatency,
  formatRelativeTime,
  statusAccent,
} from "@/components/requests/request-time-groups";
import { StatusBadge } from "@/components/requests/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { useReplayRequest } from "@/hooks/use-replay-request";
import type { InspectorRequestSummary } from "@/lib/api";
import { cn } from "@/lib/utils";

const ACCENT_BORDER: Record<ReturnType<typeof statusAccent>, string> = {
  pending: "border-l-signal-orange/70",
  ok: "border-l-metric-green",
  redirect: "border-l-pale-stone",
  client: "border-l-signal-orange",
  server: "border-l-signal-orange",
  unknown: "border-l-ash-stroke",
};

const ACCENT_DOT: Record<ReturnType<typeof statusAccent>, string> = {
  pending: "bg-signal-orange animate-mc-live",
  ok: "bg-metric-green",
  redirect: "bg-pale-stone",
  client: "bg-signal-orange",
  server: "bg-signal-orange",
  unknown: "bg-graphite-mid",
};

interface ExplorerRequestCardProps {
  readonly request: InspectorRequestSummary;
  readonly searchQuery: string;
  readonly expanded: boolean;
  readonly focused: boolean;
  readonly maxLatencyMs: number;
  readonly detailHref: string;
  readonly onToggle: () => void;
  readonly onFocus: () => void;
  readonly onOpen: () => void;
  readonly cardRef?: (node: HTMLElement | null) => void;
}

/**
 * Expandable timeline card for the Request Explorer.
 */
export function ExplorerRequestCard({
  request,
  searchQuery,
  expanded,
  focused,
  maxLatencyMs,
  detailHref,
  onToggle,
  onFocus,
  onOpen,
  cardRef,
}: ExplorerRequestCardProps) {
  const replay = useReplayRequest();
  const panelId = useId();
  const accent = statusAccent(request.status);
  const pending = request.status === undefined;

  const onCardKeyDown = (event: KeyboardEvent<HTMLElement>): void => {
    if (event.target !== event.currentTarget) {
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      onOpen();
      return;
    }
    if (event.key === " ") {
      event.preventDefault();
      onToggle();
    }
  };

  return (
    <article
      ref={cardRef}
      tabIndex={0}
      data-request-id={request.id}
      data-focused={focused ? "true" : undefined}
      aria-expanded={expanded}
      aria-controls={panelId}
      onFocus={onFocus}
      onClick={onFocus}
      onKeyDown={onCardKeyDown}
      className={cn(
        "group relative scroll-mt-44 rounded-[10px] border border-ash-stroke border-l-[3px] bg-carbon-lift shadow-hairline outline-none transition-machine sm:scroll-mt-48",
        ACCENT_BORDER[accent],
        "surface-interactive hover:bg-[color-mix(in_srgb,#1d1a18_92%,#eeeeee)] hover:shadow-panel",
        focused && "border-pale-stone shadow-panel ring-1 ring-pale-stone/25",
        expanded && "shadow-panel",
      )}
    >
      <div className="flex gap-3 p-3 sm:gap-4 sm:p-3.5">
        <div className="flex w-14 shrink-0 flex-col items-center pt-1 sm:w-16">
          <span className={cn("size-2 rounded-full", ACCENT_DOT[accent])} aria-hidden />
          <span className="mt-2 font-mono text-[10px] leading-tight text-warm-granite tabular-nums">
            {formatClock(request.timestamp)}
          </span>
        </div>

        <div className="min-w-0 flex-1 space-y-2.5">
          <div className="flex flex-wrap items-center gap-2">
            <MethodBadge method={request.method} />
            <StatusBadge status={request.status} />
            {pending ? (
              <span className="text-caption text-signal-orange">In flight</span>
            ) : null}
            <span className="ml-auto font-mono text-[11px] text-warm-granite tabular-nums">
              {formatRelativeTime(request.timestamp)}
            </span>
          </div>

          <button
            type="button"
            className="block w-full truncate text-left font-mono text-sm tracking-tight text-bone transition-machine hover:text-chalk sm:text-[15px]"
            onClick={(event) => {
              event.stopPropagation();
              onToggle();
            }}
          >
            <HighlightText text={request.path} query={searchQuery} />
          </button>

          <div className="flex flex-wrap items-center gap-3">
            <div className="min-w-[7rem] flex-1 sm:max-w-[14rem]">
              <LatencyBar latencyMs={request.latencyMs} maxMs={maxLatencyMs} />
            </div>
            <span className="font-mono text-[11px] text-warm-granite tabular-nums">
              {formatLatency(request.latencyMs)}
            </span>
            {request.matches !== undefined && request.matches.length > 0 ? (
              <MatchFieldBadges matches={request.matches} className="ml-auto" />
            ) : null}
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-0.5">
            <Button
              type="button"
              variant="ghost"
              size="xs"
              className="text-warm-granite"
              aria-expanded={expanded}
              aria-controls={panelId}
              onClick={(event) => {
                event.stopPropagation();
                onToggle();
              }}
            >
              <ChevronDownIcon
                className={cn(
                  "size-3.5 transition-transform duration-200",
                  expanded && "rotate-180",
                )}
              />
              {expanded ? "Collapse" : "Expand"}
            </Button>

            <Button
              type="button"
              variant="outline"
              size="xs"
              disabled={replay.isPending || pending}
              title={
                pending
                  ? "Wait for the response before replaying"
                  : "Replay through the live tunnel"
              }
              onClick={(event) => {
                event.stopPropagation();
                replay.mutate(request.id);
              }}
            >
              {replay.isPending ? (
                <Loader2Icon className="size-3 animate-spin" />
              ) : (
                <RotateCcwIcon className="size-3" />
              )}
              {replay.isPending ? "Replaying…" : replay.isSuccess ? "Replayed" : "Replay"}
            </Button>

            <Link
              href={detailHref}
              className={cn(buttonVariants({ variant: "default", size: "xs" }), "ml-auto")}
              onClick={(event) => event.stopPropagation()}
            >
              <ScanSearchIcon className="size-3" />
              Inspect
            </Link>
          </div>

          {replay.isError ? (
            <p className="text-xs text-signal-orange" role="alert">
              {replay.error instanceof Error ? replay.error.message : "Replay failed"}
            </p>
          ) : null}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {expanded ? (
          <motion.div
            id={panelId}
            key="expanded"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.18, ease: [0.4, 0, 0.2, 1] }}
            className="overflow-hidden border-t border-ash-stroke"
          >
            <dl className="grid gap-3 px-3 py-3 sm:grid-cols-2 sm:px-4 sm:pl-[4.75rem] lg:grid-cols-4">
              <Meta label="Request id">
                <HighlightText
                  text={request.id}
                  query={searchQuery}
                  className="break-all font-mono text-xs text-bone"
                />
              </Meta>
              <Meta label="Tunnel">
                <HighlightText
                  text={request.tunnelId}
                  query={searchQuery}
                  className="break-all font-mono text-xs text-bone"
                />
              </Meta>
              <Meta label="Timestamp">
                <span className="font-mono text-xs text-bone tabular-nums">
                  {new Date(request.timestamp).toLocaleString()}
                </span>
              </Meta>
              <Meta label="Bodies">
                <span className="font-mono text-xs text-bone tabular-nums">
                  req {formatBytes(request.requestBodyByteLength)} · res{" "}
                  {formatBytes(request.responseBodyByteLength)}
                </span>
              </Meta>
              {request.error !== undefined ? (
                <Meta label="Error">
                  <span className="font-mono text-xs text-signal-orange">{request.error}</span>
                </Meta>
              ) : null}
            </dl>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </article>
  );
}

function Meta({ label, children }: { readonly label: string; readonly children: ReactNode }) {
  return (
    <div className="min-w-0">
      <dt className="text-caption text-pale-stone">{label}</dt>
      <dd className="mt-1.5">{children}</dd>
    </div>
  );
}

function formatBytes(value: number): string {
  if (value < 1024) {
    return `${String(value)}B`;
  }
  return `${(value / 1024).toFixed(1)}KB`;
}
