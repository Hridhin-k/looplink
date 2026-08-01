"use client";

import { CodeBlock } from "@/components/requests/code-block";
import { HighlightText } from "@/components/requests/highlight-text";
import { CopyButton } from "@/components/motion/copy-button";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { DecodedBody } from "@/lib/request-body";
import { cn } from "@/lib/utils";

interface BodyViewerProps {
  readonly body: DecodedBody;
  readonly title?: string;
  readonly className?: string;
  readonly highlightQuery?: string;
  /** Emphasize response framing (status strip styling handled by parent). */
  readonly variant?: "request" | "response";
}

/**
 * Formatted + syntax-highlighted HTTP body viewer with DevTools chrome.
 */
export function BodyViewer({
  body,
  title = "Body",
  className,
  highlightQuery = "",
  variant = "request",
}: BodyViewerProps) {
  const query = highlightQuery.trim();
  const preferHighlight =
    query.length > 0 &&
    !body.isEmpty &&
    !body.isBinary &&
    body.formatted.toLowerCase().includes(query.toLowerCase());

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[10px] border border-ash-stroke bg-carbon-lift shadow-panel transition-machine",
        variant === "response" && "border-metric-green/25",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-ash-stroke px-3 py-2.5 sm:px-4">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-caption text-pale-stone">{title}</p>
          <span className="rounded-[3px] border border-ash-stroke px-1.5 py-0.5 font-mono text-[10px] text-warm-granite uppercase">
            {body.language}
          </span>
          {body.language === "json" && !body.isEmpty ? (
            <span className="text-caption text-metric-green">Pretty</span>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[11px] text-warm-granite tabular-nums">
            {String(body.byteLength)} bytes
          </span>
          {body.truncated ? (
            <span className="font-mono text-[11px] text-signal-orange">truncated</span>
          ) : null}
          {body.isBinary ? (
            <span className="font-mono text-[11px] text-warm-granite">binary</span>
          ) : null}
          <CopyButton
            value={body.formatted}
            size="xs"
            variant="ghost"
            disabled={body.isEmpty || body.isBinary}
          />
        </div>
      </div>

      {preferHighlight ? (
        <ScrollArea className="max-h-[32rem]">
          <pre className="overflow-x-auto p-4 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-bone">
            <HighlightText text={body.formatted} query={query} />
          </pre>
        </ScrollArea>
      ) : (
        <CodeBlock
          code={body.formatted}
          language={body.isBinary ? "plaintext" : body.language}
          emptyLabel="No body"
          className="rounded-none border-0 bg-transparent"
          maxHeightClassName="max-h-[32rem]"
        />
      )}
    </div>
  );
}
