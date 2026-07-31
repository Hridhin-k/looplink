import type WebSocket from "ws";

import type { TunnelOwnership } from "./tunnel-context.js";

/**
 * In-memory record for an active tunnel session bound to a WebSocket client.
 *
 * Every tunnel belongs to exactly one {@link TunnelOwnership} (engine-level).
 * Business services use the Context Engine {@link import("../context/tunnel-context.interface.js").TunnelContext}.
 */
export interface TunnelRecord {
  /** Unique tunnel identifier. */
  readonly id: string;
  /** Connected Badger client that owns this tunnel. */
  readonly client: WebSocket;
  /** Local TCP port on the client machine that this tunnel exposes. */
  readonly port: number;
  /** Logical owner (anonymous session or workspace). */
  readonly context: TunnelOwnership;
  /**
   * Workspace id when context is workspace-scoped (traffic / inspector tagging).
   * Absent for anonymous tunnels.
   */
  readonly workspaceId?: string;
  /** Anonymous session id when context is anonymous. */
  readonly anonymousSessionId?: string;
  /** Account that created a workspace-scoped tunnel (absent for anonymous). */
  readonly ownerUserId?: string;
}

/**
 * Tunnel that lost its WebSocket and may still be reclaimed by a reconnecting client.
 */
export interface OrphanedTunnel {
  /** Unique tunnel identifier (same as before disconnect). */
  readonly id: string;
  /** Local TCP port the tunnel was exposing. */
  readonly port: number;
  /** Epoch ms when the client disconnected. */
  readonly disconnectedAt: number;
  /** Logical owner preserved for reclaim matching. */
  readonly context: TunnelOwnership;
  /** Workspace id when context is workspace-scoped. */
  readonly workspaceId?: string;
  /** Anonymous session id when context is anonymous. */
  readonly anonymousSessionId?: string;
  /** Account that created a workspace-scoped tunnel. */
  readonly ownerUserId?: string;
}

/**
 * Result of creating a tunnel session, including its public URL.
 */
export interface CreatedTunnel {
  /** Persisted tunnel record. */
  readonly tunnel: TunnelRecord;
  /** Public HTTPS URL that will eventually reach the local port. */
  readonly publicUrl: string;
  /** `true` when an orphaned tunnel was reclaimed instead of minting a new id. */
  readonly restored: boolean;
}
