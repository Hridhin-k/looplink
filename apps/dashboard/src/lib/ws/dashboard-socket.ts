"use client";

import {
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
}

/**
 * Creates a reconnecting dashboard live client for the configured server.
 */
export function createDashboardSocketClient(
  options: CreateDashboardSocketClientOptions = {},
): DashboardLiveClient {
  const wsUrl = withWorkspaceScope(getDashboardWebSocketUrl(), options.workspaceId);
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

function withWorkspaceScope(url: string, workspaceId?: string): string {
  if (workspaceId === undefined || workspaceId.trim().length === 0) {
    return url;
  }
  const parsed = new URL(url);
  parsed.searchParams.set("workspaceId", workspaceId.trim());
  return parsed.toString();
}
