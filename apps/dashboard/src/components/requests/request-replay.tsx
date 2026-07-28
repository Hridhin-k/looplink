"use client";

import { Loader2Icon, RotateCcwIcon } from "lucide-react";
import { motion } from "framer-motion";

import { BodyViewer } from "@/components/requests/body-viewer";
import { KeyValueTable } from "@/components/requests/key-value-table";
import { MethodBadge } from "@/components/requests/method-badge";
import { StatusBadge } from "@/components/requests/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { useReplayRequest } from "@/hooks/use-replay-request";
import { ApiError, type InspectorReplayResponse } from "@/lib/api";
import {
  decodeTrafficBody,
  flattenHeaderMap,
  getHeaderValue,
  parseSetCookieHeaders,
} from "@/lib/request-body";

interface RequestReplayProps {
  readonly requestId: string;
}

/**
 * Replay control + live response panel for a recorded exchange.
 */
export function RequestReplay({ requestId }: RequestReplayProps) {
  const replay = useReplayRequest();

  return (
    <section className="flex flex-col gap-4" aria-label="Request replay">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">Replay</p>
          <p className="text-xs text-muted-foreground">
            Re-send this request through the live tunnel forward path.
          </p>
        </div>
        <Button type="button" onClick={() => replay.mutate(requestId)} disabled={replay.isPending}>
          {replay.isPending ? (
            <Loader2Icon className="size-4 animate-spin" />
          ) : (
            <RotateCcwIcon className="size-4" />
          )}
          {replay.isPending ? "Replaying…" : "Replay"}
        </Button>
      </div>

      {replay.isError ? (
        <Alert variant="destructive">
          <AlertTitle>Replay failed</AlertTitle>
          <AlertDescription className="font-mono text-xs">
            {formatReplayError(replay.error)}
          </AlertDescription>
        </Alert>
      ) : null}

      {replay.data !== undefined ? (
        <motion.div
          key={`${replay.data.originalRequestId}-${String(replay.submittedAt)}`}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
        >
          <ReplayResponseView result={replay.data} />
        </motion.div>
      ) : null}
    </section>
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
    <div className="overflow-hidden rounded-xl border border-border/80">
      <div className="flex flex-wrap items-center gap-2 border-b border-border/70 px-4 py-3">
        <p className="text-sm font-medium">Replay response</p>
        <MethodBadge method={result.method} />
        <StatusBadge status={result.statusCode} />
        <span className="font-mono text-[11px] text-muted-foreground">{result.path}</span>
      </div>

      <div className="flex flex-col gap-5 px-4 py-4">
        <dl className="grid gap-3 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-muted-foreground">Tunnel</dt>
            <dd className="font-mono text-xs break-all">{result.tunnelId}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Original request</dt>
            <dd className="font-mono text-xs break-all">{result.originalRequestId}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Flags</dt>
            <dd className="font-mono text-xs">
              {[
                result.bodyTruncated ? "body truncated" : null,
                result.requestBodyTruncated ? "request body truncated" : null,
              ]
                .filter(Boolean)
                .join(" · ") || "—"}
            </dd>
          </div>
        </dl>

        <Separator />

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Headers</h3>
          <KeyValueTable entries={headers} emptyLabel="No response headers" />
        </section>

        <section className="flex flex-col gap-2">
          <h3 className="text-sm font-medium">Set-Cookie</h3>
          <KeyValueTable entries={cookies} emptyLabel="No Set-Cookie headers" />
        </section>

        <BodyViewer body={body} title="Body" />
      </div>
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
