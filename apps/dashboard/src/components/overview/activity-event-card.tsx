"use client";

import Link from "next/link";
import { Loader2Icon, RotateCcwIcon, ScanSearchIcon } from "lucide-react";
import { motion } from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";

import { MethodBadge } from "@/components/requests/method-badge";
import { StatusBadge } from "@/components/requests/status-badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { useReplayRequest } from "@/hooks/use-replay-request";
import type { InspectorRequestSummary } from "@/lib/api";
import { cn } from "@/lib/utils";

interface ActivityEventCardProps {
  readonly event: InspectorRequestSummary;
  readonly workspaceName: string;
}

/**
 * Single live activity event — card layout with inspect + replay actions.
 */
export function ActivityEventCard({ event, workspaceName }: ActivityEventCardProps) {
  const replay = useReplayRequest();
  const [flash, setFlash] = useState(false);
  const prevStatus = useRef(event.status);
  const prevLatency = useRef(event.latencyMs);
  const pending = event.status === undefined;

  useEffect(() => {
    const statusChanged = prevStatus.current !== event.status;
    const latencyChanged = prevLatency.current !== event.latencyMs;
    prevStatus.current = event.status;
    prevLatency.current = event.latencyMs;
    if (!statusChanged && !latencyChanged) {
      return;
    }
    if (event.status === undefined) {
      return;
    }
    setFlash(true);
    const timer = window.setTimeout(() => setFlash(false), 600);
    return () => window.clearTimeout(timer);
  }, [event.status, event.latencyMs]);

  return (
    <article
      className={cn(
        "rounded-[10px] border border-ash-stroke bg-carbon-lift p-4 shadow-panel transition-machine sm:p-5",
        "hover:border-pale-stone/50",
        pending && "border-ash-stroke/80",
        flash &&
          "animate-mc-success-flash border-metric-green/40 bg-[color-mix(in_srgb,#1d1a18_88%,#a0ca92)]",
      )}
    >
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <MethodBadge method={event.method} />
            <StatusBadge status={event.status} />
            {pending ? (
              <span className="inline-flex items-center gap-1.5 text-caption text-signal-orange">
                <span className="size-1.5 animate-mc-live rounded-full bg-signal-orange" aria-hidden />
                In flight
              </span>
            ) : null}
          </div>

          <p className="truncate font-mono text-base tracking-tight text-bone sm:text-lg">
            {event.path}
          </p>

          <dl className="flex flex-wrap gap-x-5 gap-y-2 text-xs">
            <MetaItem label="Latency">
              {event.latencyMs !== undefined ? `${String(event.latencyMs)}ms` : "—"}
            </MetaItem>
            <MetaItem label="Time">{formatTime(event.timestamp)}</MetaItem>
            <MetaItem label="Workspace">{workspaceName}</MetaItem>
            <MetaItem label="Tunnel">{truncateId(event.tunnelId)}</MetaItem>
          </dl>
        </div>

        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={replay.isPending || pending}
            title={pending ? "Wait for the response before replaying" : "Replay through the live tunnel"}
            onClick={() => replay.mutate(event.id)}
          >
            {replay.isPending ? (
              <Loader2Icon className="size-3.5 animate-spin" />
            ) : (
              <RotateCcwIcon className="size-3.5" />
            )}
            {replay.isPending ? "Replaying…" : replay.isSuccess ? "Replayed" : "Replay"}
          </Button>

          <Link
            href={`/requests/${encodeURIComponent(event.id)}`}
            className={cn(buttonVariants({ variant: "default", size: "sm" }))}
          >
            <ScanSearchIcon className="size-3.5" />
            Inspect
          </Link>
        </div>
      </div>

      {replay.isError ? (
        <motion.p
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: "auto" }}
          className="mt-3 text-xs text-signal-orange"
          role="alert"
        >
          {replay.error instanceof Error ? replay.error.message : "Replay failed"}
        </motion.p>
      ) : null}
    </article>
  );
}

function MetaItem({
  label,
  children,
}: {
  readonly label: string;
  readonly children: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-caption text-pale-stone">{label}</dt>
      <dd className="mt-1 truncate font-mono text-warm-granite tabular-nums">{children}</dd>
    </div>
  );
}

function formatTime(timestamp: number): string {
  return new Date(timestamp).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function truncateId(id: string): string {
  if (id.length <= 16) {
    return id;
  }
  return `${id.slice(0, 6)}…${id.slice(-4)}`;
}
