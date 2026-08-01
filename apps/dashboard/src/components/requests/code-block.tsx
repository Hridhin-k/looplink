"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";
import { codeToHtml } from "shiki";

import { ScrollArea } from "@/components/ui/scroll-area";
import type { BodyLanguage } from "@/lib/request-body";
import { cn } from "@/lib/utils";

const LANG_MAP: Record<BodyLanguage, string> = {
  json: "json",
  html: "html",
  xml: "xml",
  css: "css",
  javascript: "javascript",
  plaintext: "plaintext",
};

interface CodeBlockProps {
  readonly code: string;
  readonly language: BodyLanguage;
  readonly className?: string;
  readonly maxHeightClassName?: string;
  readonly emptyLabel?: string;
}

/**
 * Syntax-highlighted code panel (Shiki). Formats JSON upstream before passing `code`.
 */
export function CodeBlock({
  code,
  language,
  className,
  maxHeightClassName = "max-h-[28rem]",
  emptyLabel = "Empty",
}: CodeBlockProps) {
  const { resolvedTheme } = useTheme();
  const theme = resolvedTheme === "dark" ? "github-dark" : "github-light";
  const highlightKey = `${language}:${theme}:${code}`;

  const [html, setHtml] = useState<string | null>(null);
  const [activeKey, setActiveKey] = useState(highlightKey);

  if (activeKey !== highlightKey) {
    setActiveKey(highlightKey);
    setHtml(null);
  }

  useEffect(() => {
    if (code.length === 0) {
      return;
    }

    let cancelled = false;

    void codeToHtml(code, {
      lang: LANG_MAP[language],
      theme,
    })
      .then((result) => {
        if (!cancelled) {
          setHtml(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setHtml(null);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [code, language, theme]);

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
      <ScrollArea className={cn(maxHeightClassName)}>
        {html === null ? (
          <pre className="overflow-x-auto p-4 font-mono text-[12px] leading-relaxed whitespace-pre-wrap text-bone">
            {code}
          </pre>
        ) : (
          <div
            className="code-block text-[12px] leading-relaxed [&_pre]:m-0 [&_pre]:bg-transparent! [&_pre]:p-4 [&_code]:font-mono"
            dangerouslySetInnerHTML={{ __html: html }}
          />
        )}
      </ScrollArea>
    </div>
  );
}
