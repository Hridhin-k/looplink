"use client";

import { Loader2Icon, RotateCcwIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState } from "react";

import { BodyViewer } from "@/components/requests/body-viewer";
import { KeyValueTable } from "@/components/requests/key-value-table";
import { MethodBadge } from "@/components/requests/method-badge";
import { StatusBadge } from "@/components/requests/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { useReplayRequest } from "@/hooks/use-replay-request";
import { ApiError, type InspectorReplayResponse } from "@/lib/api";
import {
  decodeTrafficBody,
  flattenHeaderMap,
  getHeaderValue,
  parseSetCookieHeaders,
} from "@/lib/request-body";
import { duration, MACHINE_EASE, successReveal } from "@/lib/motion";
import { cn } from "@/lib/utils";

interface RequestReplayProps {
  readonly requestId: string;
  readonly onReplayingChange?: (replaying: boolean) => void;
}

/**
 * Replay control + animated response panel for a recorded exchange.
 */
export function RequestReplay({ requestId, onReplayingChange }: RequestReplayProps) {
  const replay = useReplayRequest();
  const reduce = useReducedMotion();
  const [resultKey, setResultKey] = useState(0);

  const trigger = (): void => {
    onReplayingChange?.(true);
    replay.mutate(requestId, {
      onSuccess: () => {
        setResultKey((k) => k + 1);
      },
      onSettled: () => {
        onReplayingChange?.(false);
      },
    });
  };

  return (
    <section
      className="overflow-hidden rounded-[10px] border border-ash-stroke bg-carbon-lift shadow-panel"
      aria-label="Request replay"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-ash-stroke px-4 py-3 sm:px-5">
        <div>
          <p className="text-caption text-pale-stone">Replay</p>
          <p className="mt-1 text-sm text-warm-granite">
            Re-send through the live tunnel forward path
          </p>
        </div>
        <Button type="button" onClick={trigger} disabled={replay.isPending}>
          {replay.isPending ? (
            <Loader2Icon className="size-4 animate-spin motion-reduce:animate-none" />
          ) : (
            <RotateCcwIcon
              className={cn(
                "size-4",
                replay.isSuccess && !replay.isPending && "text-metric-green",
              )}
            />
          )}
          {replay.isPending ? "Replaying…" : replay.isSuccess ? "Replay again" : "Replay"}
        </Button>
      </div>

      <AnimatePresence mode="wait">
        {replay.isPending ? (
          <motion.div
            key="pending"
            initial={reduce ? false : { opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={reduce ? undefined : { opacity: 0, height: 0 }}
            transition={{ duration: duration.base, ease: MACHINE_EASE }}
            className="overflow-hidden"
          >
            <ReplayProgress reduce={Boolean(reduce)} />
          </motion.div>
        ) : null}
      </AnimatePresence>

      {replay.isError ? (
        <div className="px-4 py-4 sm:px-5">
          <Alert variant="destructive">
            <AlertTitle>Replay failed</AlertTitle>
            <AlertDescription className="font-mono text-xs">
              {formatReplayError(replay.error)}
            </AlertDescription>
          </Alert>
        </div>
      ) : null}

      <AnimatePresence mode="wait">
        {replay.data !== undefined && !replay.isPending ? (
          <motion.div
            key={`${replay.data.originalRequestId}-${String(resultKey)}`}
            initial={reduce ? false : successReveal.initial}
            animate={successReveal.animate}
            exit={reduce ? undefined : successReveal.exit}
            transition={successReveal.transition}
            className="animate-mc-success-flash"
          >
            <ReplayResponseView result={replay.data} />
          </motion.div>
        ) : null}
      </AnimatePresence>
    </section>
  );
}

function ReplayProgress({ reduce }: { readonly reduce: boolean }) {
  const hops = ["Browser", "Tunnel", "Badger", "Application", "Response"] as const;

  return (
    <div className="space-y-4 border-b border-ash-stroke px-4 py-5 sm:px-5">
      <div className="relative h-1.5 overflow-hidden rounded-full bg-obsidian-canvas">
        {reduce ? (
          <div className="absolute inset-y-0 left-0 w-2/5 rounded-full bg-signal-orange" />
        ) : (
          <motion.div
            className="absolute inset-y-0 left-0 rounded-full bg-signal-orange"
            initial={{ width: "8%" }}
            animate={{ width: ["8%", "92%", "8%"] }}
            transition={{ duration: 1.8, repeat: Infinity, ease: MACHINE_EASE }}
          />
        )}
      </div>
      <ol className="flex flex-wrap gap-2">
        {hops.map((hop, index) =>
          reduce ? (
            <li
              key={hop}
              className="rounded-[3px] border border-ash-stroke px-2 py-1 text-caption text-pale-stone"
            >
              {hop}
            </li>
          ) : (
            <motion.li
              key={hop}
              initial={{ opacity: 0.35 }}
              animate={{ opacity: [0.35, 1, 0.35] }}
              transition={{
                duration: 1.6,
                repeat: Infinity,
                delay: index * 0.18,
                ease: "easeInOut",
              }}
              className="rounded-[3px] border border-ash-stroke px-2 py-1 text-caption text-pale-stone"
            >
              {hop}
            </motion.li>
          ),
        )}
      </ol>
    </div>
  );
}

function ReplayResponseView({ result }: { readonly result: InspectorReplayResponse }) {
  const contentType = getHeaderValue(result.headers, "content-type");
  const body = decodeTrafficBody(
    {
      dataBase64: result.bodyBase64,
      byteLength: result.bodyByteLength,
      truncated: result.bodyTruncated,
    },
    contentType,
  );
  const headers = flattenHeaderMap(result.headers);
  const cookies = parseSetCookieHeaders(result.setCookies);

  return (
    <div className="flex flex-col gap-5 px-4 py-4 sm:px-5">
      <div className="flex flex-wrap items-center gap-2">
        <p className="text-sm text-bone">Replay response</p>
        <MethodBadge method={result.method} />
        <StatusBadge status={result.statusCode} />
        <span className="font-mono text-[11px] text-warm-granite">{result.path}</span>
      </div>

      <dl className="grid gap-3 rounded-[10px] border border-ash-stroke bg-obsidian-canvas/40 p-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-caption text-pale-stone">Tunnel</dt>
          <dd className="mt-1.5 font-mono text-xs break-all text-bone">{result.tunnelId}</dd>
        </div>
        <div>
          <dt className="text-caption text-pale-stone">Original request</dt>
          <dd className="mt-1.5 font-mono text-xs break-all text-bone">
            {result.originalRequestId}
          </dd>
        </div>
        <div>
          <dt className="text-caption text-pale-stone">Flags</dt>
          <dd className="mt-1.5 font-mono text-xs text-bone">
            {[
              result.bodyTruncated ? "body truncated" : null,
              result.requestBodyTruncated ? "request body truncated" : null,
            ]
              .filter(Boolean)
              .join(" · ") || "—"}
          </dd>
        </div>
      </dl>

      <section className="flex flex-col gap-2">
        <h3 className="text-caption text-pale-stone">Headers</h3>
        <KeyValueTable entries={headers} emptyLabel="No response headers" grouped />
      </section>

      <section className="flex flex-col gap-2">
        <h3 className="text-caption text-pale-stone">Set-Cookie</h3>
        <KeyValueTable entries={cookies} emptyLabel="No Set-Cookie headers" />
      </section>

      <BodyViewer body={body} title="Body" variant="response" />
    </div>
  );
}

function formatReplayError(error: unknown): string {
  if (error instanceof ApiError) {
    if (typeof error.body === "string" && error.body.length > 0) {
      return `${error.message} — ${error.body}`;
    }
    if (
      error.body !== null &&
      typeof error.body === "object" &&
      "message" in error.body &&
      typeof (error.body as { message: unknown }).message === "string"
    ) {
      return (error.body as { message: string }).message;
    }
    return error.message;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return "Unexpected replay error";
}
