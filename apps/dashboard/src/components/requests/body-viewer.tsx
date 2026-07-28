"use client";

import { CodeBlock } from "@/components/requests/code-block";
import { HighlightText } from "@/components/requests/highlight-text";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { DecodedBody } from "@/lib/request-body";
import { cn } from "@/lib/utils";

interface BodyViewerProps {
  readonly body: DecodedBody;
  readonly title?: string;
  readonly className?: string;
  readonly highlightQuery?: string;
}

/**
 * Formatted + syntax-highlighted HTTP body viewer.
 * When `highlightQuery` is set, prefers highlighted plain text so matches are visible.
 */
export function BodyViewer({
  body,
  title = "Body",
  className,
  highlightQuery = "",
}: BodyViewerProps) {
  const query = highlightQuery.trim();
  const preferHighlight =
    query.length > 0 &&
    !body.isEmpty &&
    !body.isBinary &&
    body.formatted.toLowerCase().includes(query.toLowerCase());

  return (
    <div className={cn("flex flex-col gap-2", className)}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">{title}</p>
        <div className="flex flex-wrap items-center gap-2 font-mono text-[11px] text-muted-foreground">
          <span>{body.language}</span>
          <span aria-hidden>·</span>
          <span>{String(body.byteLength)} bytes</span>
          {body.truncated ? (
            <>
              <span aria-hidden>·</span>
              <span className="text-amber-700 dark:text-amber-300">truncated</span>
            </>
          ) : null}
          {body.isBinary ? (
            <>
              <span aria-hidden>·</span>
              <span>binary</span>
            </>
          ) : null}
        </div>
      </div>
      {preferHighlight ? (
        <div className="overflow-hidden rounded-lg border border-border/80 bg-muted/20">
          <ScrollArea className="max-h-[28rem]">
            <pre className="overflow-x-auto p-3 font-mono text-[12px] leading-relaxed whitespace-pre-wrap">
              <HighlightText text={body.formatted} query={query} />
            </pre>
          </ScrollArea>
        </div>
      ) : (
        <CodeBlock
          code={body.formatted}
          language={body.isBinary ? "plaintext" : body.language}
          emptyLabel="No body"
        />
      )}
    </div>
  );
}
