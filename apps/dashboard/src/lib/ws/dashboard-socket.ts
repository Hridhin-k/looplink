"use client";

import {
  buildDashboardWebSocketUrl,
  DashboardLiveClient,
  DashboardMessageType,
  type DashboardMessage,
  type DashboardMessageHandler,
} from "@hridhin-k/badger-shared/dashboard";

import { getDashboardWebSocketUrl } from "@/lib/env";

export type { DashboardMessage };

export interface CreateDashboardSocketClientOptions {
  readonly onOpen?: () => void;
  readonly onClose?: (info: { readonly intentional: boolean }) => void;
  readonly onReconnecting?: () => void;
  readonly workspaceId?: string;
  /** Access token for Membership-scoped live feed (query param; browsers cannot set WS Authorization). */
  readonly accessToken?: string;
}

/**
 * Creates a reconnecting dashboard live client for the configured server.
 */
export function createDashboardSocketClient(
  options: CreateDashboardSocketClientOptions = {},
): DashboardLiveClient {
  // Normalize to `/dashboard/ws` first, then attach auth query params so they
  // are not dropped by path rewriting.
  const wsUrl = withAuthAndWorkspaceScope(
    buildDashboardWebSocketUrl(getDashboardWebSocketUrl()),
    options.accessToken,
    options.workspaceId,
  );
  return new DashboardLiveClient({
    url: wsUrl,
    autoReconnect: true,
    onOpen: options.onOpen,
    onClose: options.onClose,
    onReconnecting: options.onReconnecting,
  });
}

/**
 * Subscribe helper that returns a stable unsubscribe.
 */
export function subscribeDashboardMessages(
  client: DashboardLiveClient,
  handler: DashboardMessageHandler,
): () => void {
  return client.subscribe(handler);
}

export { DashboardMessageType };

function withAuthAndWorkspaceScope(
  url: string,
  accessToken?: string,
  workspaceId?: string,
): string {
  const parsed = new URL(url);
  if (accessToken !== undefined && accessToken.trim().length > 0) {
    parsed.searchParams.set("access_token", accessToken.trim());
  }
  if (workspaceId !== undefined && workspaceId.trim().length > 0) {
    parsed.searchParams.set("workspaceId", workspaceId.trim());
  }
  return parsed.toString();
}
