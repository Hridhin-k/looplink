"use client";

import Link from "next/link";

import { EmptyState } from "@/components/layout/empty-state";

interface ActivityEmptyStateProps {
  readonly workspaceName: string;
}

/**
 * Teaches how to generate the first tunnel traffic for the Live Activity Center.
 */
export function ActivityEmptyState({ workspaceName }: ActivityEmptyStateProps) {
  return (
    <EmptyState
      eyebrow="No live traffic"
      title="Generate your first request"
      description={
        <>
          The activity feed shows requests as they hit your local tunnel for{" "}
          <span className="text-bone">{workspaceName}</span>. Start a tunnel, then call the public
          URL.
        </>
      }
      actions={
        <>
          <Link
            href="/docs/getting-started"
            className="inline-flex h-8 items-center rounded-md bg-mist px-3 text-[13px] font-medium text-iron transition-colors duration-150 hover:bg-pure-white"
          >
            Getting started
          </Link>
          <Link
            href="/tunnels"
            className="inline-flex h-8 items-center rounded-md border border-slate px-3 text-[13px] font-medium text-ash transition-colors duration-150 hover:border-ash hover:text-pure-white"
          >
            Open tunnels
          </Link>
          <Link
            href="/requests"
            className="inline-flex h-8 items-center rounded-md border border-slate px-3 text-[13px] font-medium text-ash transition-colors duration-150 hover:border-ash hover:text-pure-white"
          >
            Open requests
          </Link>
        </>
      }
      footer={
        <ol className="space-y-3 rounded-[3px] border border-ash-stroke bg-carbon-lift p-4 sm:p-5">
          <Step
            n={1}
            title="Authenticate the CLI"
            code="badger login"
          />
          <Step
            n={2}
            title="Open a tunnel to your local app"
            code="badger 3000"
          />
          <Step
            n={3}
            title="Hit the public URL"
            code="curl https://<your-tunnel-host>/"
          />
          <Step
            n={4}
            title="Watch events stream in"
            description="New requests slide into this feed. Completions update the same card with status and latency."
          />
        </ol>
      }
    />
  );
}

function Step({
  n,
  title,
  code,
  description,
}: {
  readonly n: number;
  readonly title: string;
  readonly code?: string;
  readonly description?: string;
}) {
  return (
    <li className="flex gap-3">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-[3px] border border-ash-stroke font-mono text-[11px] text-pale-stone tabular-nums">
        {n}
      </span>
      <div className="min-w-0 flex-1 space-y-1.5">
        <p className="text-sm text-bone">{title}</p>
        {code !== undefined ? (
          <pre className="overflow-x-auto font-mono text-xs text-pale-stone">{code}</pre>
        ) : null}
        {description !== undefined ? (
          <p className="text-xs leading-normal text-warm-granite">{description}</p>
        ) : null}
      </div>
    </li>
  );
}
