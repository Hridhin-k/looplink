import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

/**
 * Numbered A→Z style step list for docs.
 */
export function DocsSteps({
  steps,
}: {
  readonly steps: readonly {
    readonly title: string;
    readonly body: ReactNode;
    readonly code?: string;
  }[];
}) {
  return (
    <ol className="mt-6 space-y-4">
      {steps.map((step, index) => (
        <li
          key={step.title}
          className="flex gap-4 rounded-lg bg-ink p-4 shadow-hairline sm:p-5"
        >
          <span className="flex size-8 shrink-0 items-center justify-center rounded-md border border-slate font-mono text-[12px] text-coral-pulse tabular-nums">
            {String(index + 1).padStart(2, "0")}
          </span>
          <div className="min-w-0 flex-1 space-y-2">
            <h3 className="text-[15px] font-medium text-pure-white">{step.title}</h3>
            <div className="text-sm leading-relaxed text-smoke">{step.body}</div>
            {step.code !== undefined ? (
              <pre className="overflow-x-auto rounded-md bg-void-black p-3 font-mono text-[12px] leading-relaxed text-mist shadow-hairline">
                {step.code}
              </pre>
            ) : null}
          </div>
        </li>
      ))}
    </ol>
  );
}

export function DocsCallout({
  title,
  children,
  tone = "info",
}: {
  readonly title: string;
  readonly children: ReactNode;
  readonly tone?: "info" | "ok" | "warn";
}) {
  return (
    <aside
      className={cn(
        "my-6 rounded-lg border-l-2 bg-ink p-4 shadow-hairline",
        tone === "info" && "border-l-info-blue",
        tone === "ok" && "border-l-success-green",
        tone === "warn" && "border-l-coral-pulse",
      )}
    >
      <p className="text-eyebrow mb-2">{title}</p>
      <div className="text-sm leading-relaxed text-smoke">{children}</div>
    </aside>
  );
}

export function DocsCode({ children }: { readonly children: string }) {
  return (
    <pre className="my-4 overflow-x-auto rounded-md bg-void-black p-4 font-mono text-[12px] leading-relaxed text-mist shadow-hairline">
      {children}
    </pre>
  );
}

export function DocsP({ children }: { readonly children: ReactNode }) {
  return <p className="mt-4 text-base leading-relaxed text-smoke">{children}</p>;
}

export function DocsH2({ children }: { readonly children: ReactNode }) {
  return (
    <h2 className="mt-10 text-xl font-medium tracking-tight text-pure-white first:mt-0">
      {children}
    </h2>
  );
}

export function DocsH3({ children }: { readonly children: ReactNode }) {
  return (
    <h3 className="mt-6 text-[15px] font-medium text-pure-white">{children}</h3>
  );
}

export function DocsUl({ items }: { readonly items: readonly ReactNode[] }) {
  return (
    <ul className="mt-3 list-disc space-y-2 pl-5 text-sm leading-relaxed text-smoke">
      {items.map((item, index) => (
        <li key={index}>{item}</li>
      ))}
    </ul>
  );
}
