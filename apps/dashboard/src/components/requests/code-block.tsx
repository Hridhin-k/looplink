"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import type { BodyLanguage } from "@/lib/request-body";
import { cn } from "@/lib/utils";

interface CodeBlockProps {
  readonly code: string;
  readonly language: BodyLanguage;
  readonly className?: string;
  readonly maxHeightClassName?: string;
  readonly emptyLabel?: string;
}

/**
 * Monospace body viewer for request/response payloads.
 * Intentionally avoids Shiki — the full highlighter blew past Cloudflare Workers' 3 MiB gzip limit.
 */
export function CodeBlock({
  code,
  language,
  className,
  maxHeightClassName = "max-h-[28rem]",
  emptyLabel = "Empty",
}: CodeBlockProps) {
  if (code.length === 0) {
    return (
      <div
        className={cn(
          "rounded-[10px] border border-dashed border-ash-stroke px-3 py-8 text-center text-sm text-warm-granite",
          className,
        )}
      >
        {emptyLabel}
      </div>
    );
  }

  return (
    <div
      className={cn(
        "overflow-hidden rounded-[10px] border border-ash-stroke bg-obsidian-canvas/60",
        className,
      )}
    >
      <div className="flex items-center justify-between border-b border-ash-stroke/80 px-3 py-1.5">
        <span className="font-mono text-[10px] tracking-[0.08em] text-warm-granite uppercase">
          {language}
        </span>
      </div>
      <ScrollArea className={cn(maxHeightClassName)}>
        <pre className="overflow-x-auto p-4 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-bone">
          {code}
        </pre>
      </ScrollArea>
    </div>
  );
}
