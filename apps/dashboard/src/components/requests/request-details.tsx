"use client";

import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { motion } from "framer-motion";
import { useSearchParams } from "next/navigation";
import { useState, type ReactNode } from "react";

import { BodyViewer } from "@/components/requests/body-viewer";
import { HighlightText } from "@/components/requests/highlight-text";
import { KeyValueTable } from "@/components/requests/key-value-table";
import { MethodBadge } from "@/components/requests/method-badge";
import { RequestJourney } from "@/components/requests/request-journey";
import { RequestReplay } from "@/components/requests/request-replay";
import { RequestTimeline } from "@/components/requests/request-timeline";
import { StatusBadge } from "@/components/requests/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useInspectorRequest } from "@/hooks/use-inspector-request";
import { ApiError } from "@/lib/api";
import {
  decodeTrafficBody,
  flattenHeaderMap,
  getHeaderValue,
  getHeaderValues,
  parseCookieHeader,
  parseSetCookieHeaders,
} from "@/lib/request-body";
import { statusAccent } from "@/components/requests/request-time-groups";
import { cn } from "@/lib/utils";

interface RequestDetailsProps {
  readonly requestId: string;
}

const ACCENT_BORDER = {
  pending: "border-l-signal-orange/70",
  ok: "border-l-metric-green",
  redirect: "border-l-pale-stone",
  client: "border-l-signal-orange",
  server: "border-l-signal-orange",
  unknown: "border-l-ash-stroke",
} as const;

/**
 * Full request/response inspector — DevTools-inspired detail surface.
 */
export function RequestDetails({ requestId }: RequestDetailsProps) {
  const searchParams = useSearchParams();
  const highlightQuery = searchParams.get("q")?.trim() ?? "";
  const { data, isPending, isError, error, refetch } = useInspectorRequest(requestId);
  const [replaying, setReplaying] = useState(false);

  if (isPending) {
    return <DetailsLoading />;
  }

  if (isError || data === undefined) {
    const message =
      error instanceof ApiError
        ? error.message
        : error instanceof Error
          ? error.message
          : "Request not found";

    return (
      <div className="space-y-4">
        <BackLink />
        <Alert variant="destructive">
          <AlertTitle>Could not load request</AlertTitle>
          <AlertDescription className="flex flex-col gap-3">
            <p className="font-mono text-xs">{message}</p>
            <Button type="button" variant="outline" size="sm" className="w-fit" onClick={() => void refetch()}>
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const requestContentType = getHeaderValue(data.headers, "content-type");
  const responseContentType = getHeaderValue(data.responseHeaders, "content-type");
  const requestBody = decodeTrafficBody(data.body, requestContentType);
  const responseBody = decodeTrafficBody(data.responseBody, responseContentType);

  const headers = flattenHeaderMap(data.headers);
  const query = flattenHeaderMap(data.query);
  const responseHeaders = flattenHeaderMap(data.responseHeaders);

  const requestCookies = parseCookieHeader(getHeaderValue(data.headers, "cookie"));
  const responseCookies = parseSetCookieHeaders(
    getHeaderValues(data.responseHeaders, "set-cookie"),
  );

  const accent = statusAccent(data.status);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2, ease: [0.4, 0, 0.2, 1] }}
      className="flex flex-col gap-6"
    >
      <BackLink />

      <div
        className={cn(
          "rounded-[10px] border border-ash-stroke border-l-[3px] bg-carbon-lift p-5 shadow-panel sm:p-6",
          ACCENT_BORDER[accent],
        )}
      >
        <div className="flex flex-wrap items-center gap-2">
          {highlightQuery.length > 0 &&
          data.method.toLowerCase().includes(highlightQuery.toLowerCase()) ? (
            <HighlightText
              text={data.method}
              query={highlightQuery}
              className="font-mono text-[11px] tracking-wide uppercase"
            />
          ) : (
            <MethodBadge method={data.method} />
          )}
          <StatusBadge status={data.status} />
          <span className="font-mono text-xs text-warm-granite">{data.id}</span>
        </div>
        <h1 className="mt-3 break-all font-mono text-lg tracking-tight text-bone sm:text-xl">
          <HighlightText text={data.path} query={highlightQuery} />
        </h1>
        <dl className="mt-4 grid gap-4 border-t border-ash-stroke pt-4 text-sm sm:grid-cols-3">
          <div>
            <dt className="text-caption text-pale-stone">Tunnel</dt>
            <dd className="mt-1.5 font-mono text-xs break-all text-bone">
              <HighlightText text={data.tunnelId} query={highlightQuery} />
            </dd>
          </div>
          <div>
            <dt className="text-caption text-pale-stone">Timestamp</dt>
            <dd className="mt-1.5 font-mono text-xs text-bone">
              <HighlightText
                text={new Date(data.timestamp).toLocaleString()}
                query={highlightQuery}
              />
            </dd>
          </div>
          <div>
            <dt className="text-caption text-pale-stone">Latency</dt>
            <dd className="mt-1.5 font-mono text-xs text-bone">
              {data.latencyMs === undefined ? "—" : `${String(data.latencyMs)} ms`}
            </dd>
          </div>
        </dl>
        {data.error ? (
          <Alert variant="destructive" className="mt-4">
            <AlertTitle>Error</AlertTitle>
            <AlertDescription className="font-mono text-xs">
              <HighlightText text={data.error} query={highlightQuery} />
            </AlertDescription>
          </Alert>
        ) : null}
      </div>

      <RequestJourney
        timestamp={data.timestamp}
        latencyMs={data.latencyMs}
        replaying={replaying}
      />

      <RequestTimeline timestamp={data.timestamp} latencyMs={data.latencyMs} />

      <RequestReplay requestId={data.id} onReplayingChange={setReplaying} />

      <Tabs defaultValue="request" className="gap-4">
        <TabsList variant="line" className="w-full justify-start border-b border-ash-stroke">
          <TabsTrigger value="request" className="rounded-none">
            Request
          </TabsTrigger>
          <TabsTrigger value="response" className="rounded-none">
            Response
          </TabsTrigger>
        </TabsList>

        <TabsContent value="request" className="flex flex-col gap-5">
          <Panel title="Headers">
            <KeyValueTable
              entries={headers}
              emptyLabel="No request headers"
              highlightQuery={highlightQuery}
              grouped
            />
          </Panel>

          <Panel title="Cookies">
            <KeyValueTable
              entries={requestCookies}
              emptyLabel="No request cookies"
              highlightQuery={highlightQuery}
            />
          </Panel>

          <Panel title="Query">
            <KeyValueTable
              entries={query}
              emptyLabel="No query parameters"
              highlightQuery={highlightQuery}
            />
          </Panel>

          <BodyViewer body={requestBody} title="Payload" highlightQuery={highlightQuery} />
        </TabsContent>

        <TabsContent value="response" className="flex flex-col gap-5">
          <div className="flex flex-wrap items-center gap-2 rounded-[10px] border border-ash-stroke bg-carbon-lift px-4 py-3 shadow-hairline">
            <p className="text-caption text-pale-stone">Status</p>
            <StatusBadge status={data.status} />
            {responseContentType !== undefined ? (
              <span className="ml-auto truncate font-mono text-[11px] text-warm-granite">
                {responseContentType}
              </span>
            ) : null}
          </div>

          <BodyViewer
            body={responseBody}
            title="Response body"
            highlightQuery={highlightQuery}
            variant="response"
          />

          <Panel title="Response headers">
            <KeyValueTable
              entries={responseHeaders}
              emptyLabel="No response headers"
              highlightQuery={highlightQuery}
              grouped
            />
          </Panel>

          <Panel title="Set-Cookie">
            <KeyValueTable
              entries={responseCookies}
              emptyLabel="No Set-Cookie headers"
              highlightQuery={highlightQuery}
            />
          </Panel>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}

function Panel({
  title,
  children,
}: {
  readonly title: string;
  readonly children: ReactNode;
}) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="text-caption text-pale-stone">{title}</h3>
      {children}
    </section>
  );
}

function DetailsLoading() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-7 w-40 rounded-[3px]" />
      <Skeleton className="h-36 w-full rounded-[10px]" />
      <Skeleton className="h-28 w-full rounded-[10px]" />
      <Skeleton className="h-56 w-full rounded-[10px]" />
      <div className="grid gap-3 sm:grid-cols-2">
        <Skeleton className="h-40 rounded-[10px]" />
        <Skeleton className="h-40 rounded-[10px]" />
      </div>
    </div>
  );
}

function BackLink() {
  return (
    <Link
      href="/requests"
      className="inline-flex h-7 w-fit items-center gap-1.5 rounded-[3px] px-2.5 text-sm text-warm-granite transition-machine hover:bg-carbon-lift hover:text-bone"
    >
      <ArrowLeftIcon className="size-3.5" />
      Back to requests
    </Link>
  );
}
