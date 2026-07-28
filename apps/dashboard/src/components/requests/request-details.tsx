"use client";

import Link from "next/link";
import { ArrowLeftIcon } from "lucide-react";
import { motion } from "framer-motion";
import { useSearchParams } from "next/navigation";

import { BodyViewer } from "@/components/requests/body-viewer";
import { HighlightText } from "@/components/requests/highlight-text";
import { KeyValueTable } from "@/components/requests/key-value-table";
import { MethodBadge } from "@/components/requests/method-badge";
import { RequestReplay } from "@/components/requests/request-replay";
import { RequestTimeline } from "@/components/requests/request-timeline";
import { StatusBadge } from "@/components/requests/status-badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Separator } from "@/components/ui/separator";
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

interface RequestDetailsProps {
  readonly requestId: string;
}

/**
 * Full request/response inspector for a single recorded exchange.
 */
export function RequestDetails({ requestId }: RequestDetailsProps) {
  const searchParams = useSearchParams();
  const highlightQuery = searchParams.get("q")?.trim() ?? "";
  const { data, isPending, isError, error, refetch } = useInspectorRequest(requestId);

  if (isPending) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-16 w-full" />
        <Skeleton className="h-72 w-full rounded-xl" />
      </div>
    );
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
            <button
              type="button"
              className="w-fit text-sm underline underline-offset-4"
              onClick={() => void refetch()}
            >
              Retry
            </button>
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col gap-6"
    >
      <div className="flex flex-col gap-4">
        <BackLink />

        <div className="flex flex-col gap-3">
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
            <span className="font-mono text-xs text-muted-foreground">{data.id}</span>
          </div>
          <h2 className="break-all font-mono text-lg tracking-tight sm:text-xl">
            <HighlightText text={data.path} query={highlightQuery} />
          </h2>
          <dl className="grid gap-3 text-sm sm:grid-cols-3">
            <div>
              <dt className="text-muted-foreground">Tunnel</dt>
              <dd className="font-mono text-xs break-all">
                <HighlightText text={data.tunnelId} query={highlightQuery} />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Timestamp</dt>
              <dd className="font-mono text-xs">
                <HighlightText
                  text={new Date(data.timestamp).toLocaleString()}
                  query={highlightQuery}
                />
              </dd>
            </div>
            <div>
              <dt className="text-muted-foreground">Latency</dt>
              <dd className="font-mono text-xs">
                {data.latencyMs === undefined ? "—" : `${String(data.latencyMs)} ms`}
              </dd>
            </div>
          </dl>
          {data.error ? (
            <Alert variant="destructive">
              <AlertTitle>Error</AlertTitle>
              <AlertDescription className="font-mono text-xs">
                <HighlightText text={data.error} query={highlightQuery} />
              </AlertDescription>
            </Alert>
          ) : null}
        </div>
      </div>

      <RequestTimeline timestamp={data.timestamp} latencyMs={data.latencyMs} />

      <Separator />

      <RequestReplay requestId={data.id} />

      <Separator />

      <Tabs defaultValue="request" className="gap-4">
        <TabsList>
          <TabsTrigger value="request">Request</TabsTrigger>
          <TabsTrigger value="response">Response</TabsTrigger>
        </TabsList>

        <TabsContent value="request" className="flex flex-col gap-6">
          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Headers</h3>
            <KeyValueTable
              entries={headers}
              emptyLabel="No request headers"
              highlightQuery={highlightQuery}
            />
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Cookies</h3>
            <KeyValueTable
              entries={requestCookies}
              emptyLabel="No request cookies"
              highlightQuery={highlightQuery}
            />
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Query</h3>
            <KeyValueTable
              entries={query}
              emptyLabel="No query parameters"
              highlightQuery={highlightQuery}
            />
          </section>

          <BodyViewer body={requestBody} title="Body" highlightQuery={highlightQuery} />
        </TabsContent>

        <TabsContent value="response" className="flex flex-col gap-6">
          <section className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-medium">Response</h3>
              <StatusBadge status={data.status} />
            </div>
            <BodyViewer body={responseBody} title="Body" highlightQuery={highlightQuery} />
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Response headers</h3>
            <KeyValueTable
              entries={responseHeaders}
              emptyLabel="No response headers"
              highlightQuery={highlightQuery}
            />
          </section>

          <section className="flex flex-col gap-2">
            <h3 className="text-sm font-medium">Set-Cookie</h3>
            <KeyValueTable
              entries={responseCookies}
              emptyLabel="No Set-Cookie headers"
              highlightQuery={highlightQuery}
            />
          </section>
        </TabsContent>
      </Tabs>
    </motion.div>
  );
}

function BackLink() {
  return (
    <Link
      href="/requests"
      className="inline-flex h-7 w-fit items-center gap-1.5 rounded-lg px-2.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
    >
      <ArrowLeftIcon className="size-3.5" />
      Back to requests
    </Link>
  );
}
