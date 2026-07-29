import type WebSocket from "ws";

/**
 * In-memory record for an active tunnel session bound to a WebSocket client.
 */
export interface TunnelRecord {
  /** Unique tunnel identifier. */
  readonly id: string;
  /** Connected Badger client that owns this tunnel. */
  readonly client: WebSocket;
  /** Local TCP port on the client machine that this tunnel exposes. */
  readonly port: number;
  /** Authenticated user that created the tunnel (legacy: absent). */
  readonly ownerUserId?: string;
  /** Workspace that owns this tunnel (legacy: absent). */
  readonly workspaceId?: string;
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
  /** Authenticated owner user id (legacy: absent). */
  readonly ownerUserId?: string;
  /** Owning workspace id (legacy: absent). */
  readonly workspaceId?: string;
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
