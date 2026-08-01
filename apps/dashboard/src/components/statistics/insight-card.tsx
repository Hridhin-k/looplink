import type { ReactNode } from "react";
import Link from "next/link";

import { cn } from "@/lib/utils";

interface InsightCardProps {
  readonly question: string;
  readonly answer: ReactNode;
  readonly detail?: ReactNode;
  readonly meta?: ReactNode;
  readonly href?: string;
  readonly tone?: "default" | "positive" | "warning" | "muted";
  readonly className?: string;
}

/**
 * Insight-first answer card — question, answer, supporting detail.
 */
export function InsightCard({
  question,
  answer,
  detail,
  meta,
  href,
  tone = "default",
  className,
}: InsightCardProps) {
  const content = (
    <>
      <p className="text-caption text-pale-stone">{question}</p>
      <div
        className={cn(
          "mt-3 text-xl tracking-tight text-bone sm:text-2xl",
          tone === "positive" && "text-metric-green",
          tone === "warning" && "text-signal-orange",
          tone === "muted" && "text-warm-granite",
        )}
      >
        {answer}
      </div>
      {detail !== undefined ? (
        <div className="mt-2 text-sm leading-normal text-warm-granite">{detail}</div>
      ) : null}
      {meta !== undefined ? <div className="mt-3">{meta}</div> : null}
    </>
  );

  const shellClass = cn(
    "rounded-[10px] border border-ash-stroke bg-carbon-lift p-5 shadow-panel",
    href !== undefined &&
      "surface-interactive hover:bg-[color-mix(in_srgb,#1d1a18_92%,#eeeeee)] focus-visible:ring-2 focus-visible:ring-ring/40",
    className,
  );

  if (href !== undefined) {
    return (
      <Link href={href} className={cn(shellClass, "block")}>
        {content}
      </Link>
    );
  }

  return <article className={shellClass}>{content}</article>;
}
