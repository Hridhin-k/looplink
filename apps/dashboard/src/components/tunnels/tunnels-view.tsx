"use client";

import Link from "next/link";
import { useMemo } from "react";

import { EmptyState } from "@/components/layout/empty-state";
import { LiveMeta, Panel } from "@/components/layout/surface";
import { PageHeader } from "@/components/layout/page-header";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { CopyButton } from "@/components/motion/copy-button";
import { cn } from "@/lib/utils";
import { useConnectionStore } from "@/stores/connection-store";
import { selectWorkspaceTunnels, useTunnelStore } from "@/stores/tunnel-store";

/**
 * Live tunnels for the active workspace (WebSocket-observed sessions).
 */
export function TunnelsView() {
  const { activeWorkspace } = useWorkspace();
  const live = useConnectionStore((s) => s.status) === "connected";
  const tunnelsMap = useTunnelStore((s) => s.tunnels);
  const tunnels = useMemo(
    () => selectWorkspaceTunnels(tunnelsMap, activeWorkspace?.id),
    [tunnelsMap, activeWorkspace?.id],
  );

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Tunnels"
        title="Live sessions"
        description="Forward paths observed for the active workspace. Start a CLI tunnel to populate this list."
        meta={<LiveMeta live={live} liveLabel="Socket live" idleLabel="Socket idle" />}
        actions={
          <Link
            href="/docs/tunnels"
            className="inline-flex h-8 items-center rounded-md border border-slate px-3 text-[13px] font-medium text-ash hover:border-ash hover:text-pure-white"
          >
            Tunnel docs
          </Link>
        }
      />

      {tunnels.length === 0 ? (
        <EmptyState
          eyebrow="No live tunnels"
          title="Open a tunnel from the CLI"
          description={
            <>
              Run <span className="font-mono text-mist">badger &lt;port&gt;</span> while
              signed into workspace{" "}
              <span className="text-pure-white">{activeWorkspace?.name ?? "…"}</span>.
              Anonymous tunnels will not appear here.
            </>
          }
          actions={
            <>
              <Link
                href="/docs/getting-started"
                className="inline-flex h-8 items-center rounded-md bg-mist px-3 text-[13px] font-medium text-iron hover:bg-pure-white"
              >
                Getting started
              </Link>
              <Link
                href="/docs/cli"
                className="inline-flex h-8 items-center rounded-md border border-slate px-3 text-[13px] font-medium text-ash hover:text-pure-white"
              >
                CLI reference
              </Link>
            </>
          }
          footer={
            <pre className="overflow-x-auto rounded-md bg-void-black p-4 font-mono text-xs text-mist shadow-hairline">
              {`badger login
badger 3000
# keep this process running`}
            </pre>
          }
        />
      ) : (
        <ul className="space-y-3">
          {tunnels.map((tunnel, index) => (
            <li key={tunnel.tunnelId}>
              <Panel
                className={cn(
                  "p-4 sm:p-5",
                  index === 0 && "row-active",
                )}
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0 space-y-2">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="size-1.5 animate-mc-live rounded-full bg-success-green" />
                      <p className="text-eyebrow text-success-green">Connected</p>
                      {tunnel.restored ? (
                        <span className="rounded-sm bg-graphite px-1.5 py-0.5 font-mono text-[10px] text-ash uppercase">
                          Restored
                        </span>
                      ) : null}
                    </div>
                    <p className="truncate font-mono text-sm text-mist sm:text-base">
                      {tunnel.publicUrl}
                    </p>
                    <dl className="flex flex-wrap gap-x-5 gap-y-2 text-xs text-smoke">
                      <Meta label="Local port">{String(tunnel.port)}</Meta>
                      <Meta label="Tunnel id">{truncateMiddle(tunnel.tunnelId)}</Meta>
                      <Meta label="Since">{formatSince(tunnel.connectedAt)}</Meta>
                    </dl>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <CopyButton value={tunnel.publicUrl} size="sm" variant="outline" />
                    <a
                      href={tunnel.publicUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="inline-flex h-7 items-center rounded-md border border-slate px-2.5 text-[12px] font-medium text-ash transition-machine hover:border-ash hover:text-pure-white"
                    >
                      Open
                    </a>
                  </div>
                </div>
              </Panel>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function Meta({ label, children }: { readonly label: string; readonly children: string }) {
  return (
    <div>
      <dt className="text-caption text-ash">{label}</dt>
      <dd className="mt-1 font-mono text-[12px] text-mist">{children}</dd>
    </div>
  );
}

function truncateMiddle(value: string): string {
  if (value.length <= 18) {
    return value;
  }
  return `${value.slice(0, 8)}…${value.slice(-6)}`;
}

function formatSince(ts: number): string {
  const delta = Math.max(0, Date.now() - ts);
  const sec = Math.floor(delta / 1000);
  if (sec < 60) {
    return `${String(sec)}s ago`;
  }
  const min = Math.floor(sec / 60);
  if (min < 60) {
    return `${String(min)}m ago`;
  }
  const hr = Math.floor(min / 60);
  return `${String(hr)}h ago`;
}
