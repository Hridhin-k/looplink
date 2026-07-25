import type WebSocket from "ws";

/**
 * In-memory record for an active tunnel session bound to a WebSocket client.
 */
export interface TunnelRecord {
  /** Unique tunnel identifier. */
  readonly id: string;
  /** Connected LoopLink client that owns this tunnel. */
  readonly client: WebSocket;
  /** Local TCP port on the client machine that this tunnel exposes. */
  readonly port: number;
}

/**
 * Result of creating a tunnel session, including its public URL.
 */
export interface CreatedTunnel {
  /** Persisted tunnel record. */
  readonly tunnel: TunnelRecord;
  /** Public HTTPS URL that will eventually reach the local port. */
  readonly publicUrl: string;
}
