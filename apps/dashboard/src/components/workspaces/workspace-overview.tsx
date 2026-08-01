"use client";

import Link from "next/link";
import { useMemo } from "react";

import { MethodBadge } from "@/components/requests/method-badge";
import { StatusBadge } from "@/components/requests/status-badge";
import { InsightCard } from "@/components/statistics/insight-card";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { useInspectorRequests } from "@/hooks/use-inspector-requests";
import { useInspectorStatistics } from "@/hooks/use-inspector-statistics";
import type { WorkspaceApiKey, WorkspaceInvitation, WorkspaceMember } from "@/lib/workspaces/types";
import { cn } from "@/lib/utils";
import { useConnectionStore } from "@/stores/connection-store";
import { selectWorkspaceTunnels, useTunnelStore } from "@/stores/tunnel-store";

interface WorkspaceOverviewProps {
  readonly members: readonly WorkspaceMember[] | undefined;
  readonly membersLoading: boolean;
  readonly apiKeys: readonly WorkspaceApiKey[] | undefined;
  readonly apiKeysLoading: boolean;
  readonly canManageKeys: boolean;
  readonly pendingInvites: number;
  readonly invitations: readonly WorkspaceInvitation[] | undefined;
  readonly onOpenSettings: (tab: string) => void;
}

/**
 * Workspace Hub overview — health, counts, and recent activity.
 */
export function WorkspaceOverview({
  members,
  membersLoading,
  apiKeys,
  apiKeysLoading,
  canManageKeys,
  pendingInvites,
  invitations,
  onOpenSettings,
}: WorkspaceOverviewProps) {
  const { activeWorkspace } = useWorkspace();
  const live = useConnectionStore((s) => s.status) === "connected";
  const tunnelsMap = useTunnelStore((s) => s.tunnels);
  const liveTunnels = selectWorkspaceTunnels(tunnelsMap, activeWorkspace?.id);

  const { data: stats } = useInspectorStatistics();
  const { data: requests } = useInspectorRequests({ limit: 40 });

  const todayStart = useMemo(() => {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }, []);

  const requestsToday = useMemo(
    () => (requests?.items ?? []).filter((item) => item.timestamp >= todayStart).length,
    [requests?.items, todayStart],
  );

  const recent = useMemo(() => (requests?.items ?? []).slice(0, 6), [requests?.items]);

  const activeKeys = (apiKeys ?? []).filter((key) => key.revokedAt === null).length;
  const memberCount = members?.length ?? 0;
  const errorRate = stats?.errorRate ?? 0;
  const health = deriveHealth({
    live,
    tunnelCount: liveTunnels.length,
    errorRate,
    hasTraffic: (stats?.totalRequests ?? 0) > 0 || requestsToday > 0,
  });

  return (
    <section className="space-y-5" aria-label="Workspace overview">
      <div>
        <p className="text-caption text-pale-stone">Overview</p>
        <h2 className="mt-1.5 text-xl tracking-tight text-bone">Workspace hub</h2>
        <p className="mt-1 text-sm text-warm-granite">
          Health and activity for {activeWorkspace?.name ?? "this workspace"}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        <InsightCard
          question="Workspace health"
          answer={health.label}
          detail={health.detail}
          tone={health.tone}
        />
        <InsightCard
          question="Members"
          answer={membersLoading ? "…" : String(memberCount)}
          detail={
            pendingInvites > 0
              ? `${String(pendingInvites)} pending invite${pendingInvites === 1 ? "" : "s"}`
              : "People with access"
          }
          meta={
            <button
              type="button"
              className="text-xs text-pale-stone underline-offset-4 hover:text-bone hover:underline"
              onClick={() => onOpenSettings("members")}
            >
              Manage members
            </button>
          }
        />
        <InsightCard
          question="Requests today"
          answer={String(requestsToday)}
          detail={
            stats !== undefined
              ? `${String(stats.totalRequests)} retained total · ${formatRate(stats.requestsPerMinute)} / min`
              : "From inspector traffic"
          }
          href="/requests"
        />
        <InsightCard
          question="Active tunnels"
          answer={String(liveTunnels.length)}
          detail={
            liveTunnels[0] !== undefined
              ? liveTunnels[0].publicUrl
              : "Waiting for a live tunnel session"
          }
          tone={liveTunnels.length > 0 ? "positive" : "muted"}
        />
        <InsightCard
          question="API keys"
          answer={
            !canManageKeys ? "—" : apiKeysLoading ? "…" : String(activeKeys)
          }
          detail={
            !canManageKeys
              ? "Owners and admins manage keys"
              : activeKeys === 0
                ? "No active keys yet"
                : `${String(activeKeys)} active for CI / CLI`
          }
          meta={
            canManageKeys ? (
              <button
                type="button"
                className="text-xs text-pale-stone underline-offset-4 hover:text-bone hover:underline"
                onClick={() => onOpenSettings("api-keys")}
              >
                Manage keys
              </button>
            ) : null
          }
        />
        <InsightCard
          question="Pending invites"
          answer={canManageKeys ? String(pendingInvites) : "—"}
          detail={
            canManageKeys
              ? pendingInvites === 0
                ? "No outstanding invitations"
                : "Awaiting acceptance"
              : "Invite management requires admin access"
          }
          meta={
            canManageKeys ? (
              <button
                type="button"
                className="text-xs text-pale-stone underline-offset-4 hover:text-bone hover:underline"
                onClick={() => onOpenSettings("invites")}
              >
                Invite people
              </button>
            ) : null
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <RecentActivity recent={recent} />
        <InvitePulse invitations={invitations} canManage={canManageKeys} onOpenSettings={onOpenSettings} />
      </div>
    </section>
  );
}

function RecentActivity({
  recent,
}: {
  readonly recent: readonly {
    readonly id: string;
    readonly method: string;
    readonly path: string;
    readonly status?: number;
    readonly timestamp: number;
  }[];
}) {
  return (
    <div className="rounded-[10px] border border-ash-stroke bg-carbon-lift shadow-panel">
      <div className="flex items-center justify-between border-b border-ash-stroke px-4 py-3">
        <div>
          <p className="text-caption text-pale-stone">Recent activity</p>
          <p className="mt-1 text-sm text-warm-granite">Latest inspector traffic</p>
        </div>
        <Link
          href="/overview"
          className="text-xs text-pale-stone underline-offset-4 hover:text-bone hover:underline"
        >
          Live feed
        </Link>
      </div>
      {recent.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-warm-granite">
          No recent requests. Start a tunnel to fill this feed.
        </div>
      ) : (
        <ul className="divide-y divide-ash-stroke">
          {recent.map((item) => (
            <li key={item.id}>
              <Link
                href={`/requests/${encodeURIComponent(item.id)}`}
                className="flex flex-wrap items-center gap-2 px-4 py-2.5 transition-machine hover:bg-obsidian-canvas/50"
              >
                <MethodBadge method={item.method} />
                <StatusBadge status={item.status} />
                <span className="min-w-0 flex-1 truncate font-mono text-xs text-bone">
                  {item.path}
                </span>
                <span className="font-mono text-[10px] text-warm-granite tabular-nums">
                  {new Date(item.timestamp).toLocaleTimeString([], {
                    hour: "2-digit",
                    minute: "2-digit",
                    second: "2-digit",
                  })}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InvitePulse({
  invitations,
  canManage,
  onOpenSettings,
}: {
  readonly invitations: readonly WorkspaceInvitation[] | undefined;
  readonly canManage: boolean;
  readonly onOpenSettings: (tab: string) => void;
}) {
  const pending = (invitations ?? []).filter((row) => row.status === "pending").slice(0, 4);

  return (
    <div className="rounded-[10px] border border-ash-stroke bg-carbon-lift shadow-panel">
      <div className="flex items-center justify-between border-b border-ash-stroke px-4 py-3">
        <div>
          <p className="text-caption text-pale-stone">Invitations</p>
          <p className="mt-1 text-sm text-warm-granite">People waiting to join</p>
        </div>
        {canManage ? (
          <button
            type="button"
            className="text-xs text-pale-stone underline-offset-4 hover:text-bone hover:underline"
            onClick={() => onOpenSettings("invites")}
          >
            Open invites
          </button>
        ) : null}
      </div>
      {!canManage ? (
        <div className="px-4 py-8 text-center text-sm text-warm-granite">
          Only owners and admins can view pending invites.
        </div>
      ) : pending.length === 0 ? (
        <div className="px-4 py-8 text-center text-sm text-warm-granite">
          No pending invitations. Invite a teammate when you need shared access.
        </div>
      ) : (
        <ul className="divide-y divide-ash-stroke">
          {pending.map((invitation) => (
            <li key={invitation.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm text-bone">{invitation.email}</p>
                <p className="mt-0.5 text-xs text-warm-granite">
                  {invitation.role} · expires {new Date(invitation.expiresAt).toLocaleDateString()}
                </p>
              </div>
              <span
                className={cn(
                  "shrink-0 rounded-[3px] border border-ash-stroke px-1.5 py-0.5 text-caption text-pale-stone",
                )}
              >
                pending
              </span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function deriveHealth(input: {
  readonly live: boolean;
  readonly tunnelCount: number;
  readonly errorRate: number;
  readonly hasTraffic: boolean;
}): {
  readonly label: string;
  readonly detail: string;
  readonly tone: "default" | "positive" | "warning" | "muted";
} {
  if (!input.live) {
    return {
      label: "Offline feed",
      detail: "Dashboard WebSocket is not connected",
      tone: "warning",
    };
  }
  if (input.errorRate >= 0.15 && input.hasTraffic) {
    return {
      label: "Elevated errors",
      detail: `${(input.errorRate * 100).toFixed(0)}% error rate on retained traffic`,
      tone: "warning",
    };
  }
  if (input.tunnelCount > 0) {
    return {
      label: "Healthy",
      detail: `${String(input.tunnelCount)} live tunnel${input.tunnelCount === 1 ? "" : "s"} · feed connected`,
      tone: "positive",
    };
  }
  if (input.hasTraffic) {
    return {
      label: "Idle tunnels",
      detail: "Traffic on record, but no live tunnel session",
      tone: "muted",
    };
  }
  return {
    label: "Ready",
    detail: "Connected — waiting for a tunnel and traffic",
    tone: "default",
  };
}

function formatRate(value: number): string {
  return value.toFixed(value >= 10 ? 0 : 1);
}
