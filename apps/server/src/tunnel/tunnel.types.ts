import type WebSocket from "ws";

/**
 * In-memory record for an active tunnel session bound to a WebSocket client.
 */
export interface TunnelRecord {
  /** Unique tunnel identifier. */
  readonly id: string;
  /** Connected LoopLink client that owns this tunnel. */
  readonly client: WebSocket;
}
