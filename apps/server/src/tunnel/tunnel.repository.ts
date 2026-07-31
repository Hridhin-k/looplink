import type WebSocket from "ws";

import type { TunnelOwnership } from "./tunnel-context.js";
import type { OrphanedTunnel, TunnelRecord } from "./tunnel.types.js";

/**
 * Persistence port for active tunnel sessions.
 *
 * Implementations may be in-memory, Redis-backed, or otherwise; callers depend
 * only on this interface.
 */
export interface TunnelRepository {
  /**
   * Persists a tunnel record, replacing any existing record with the same id.
   *
   * @param tunnel - Tunnel session to store.
   */
  save(tunnel: TunnelRecord): void;

  /**
   * Removes a tunnel by id.
   *
   * @param id - Tunnel identifier.
   * @returns `true` when a record was removed.
   */
  remove(id: string): boolean;

  /**
   * Removes the tunnel associated with a WebSocket client.
   *
   * @param client - Connected client socket.
   * @returns `true` when a record was removed.
   */
  removeByClient(client: WebSocket): boolean;

  /**
   * Detaches a client and parks its tunnel as reclaimable.
   *
   * The public slug stays reserved until the orphan expires or is reclaimed.
   *
   * @param client - Disconnecting client socket.
   * @param disconnectedAt - Epoch ms of the disconnect.
   * @returns The orphaned tunnel, or `undefined` when the client had none.
   */
  orphanByClient(client: WebSocket, disconnectedAt: number): OrphanedTunnel | undefined;

  /**
   * Reclaims an orphaned tunnel for a new client socket.
   *
   * @param id - Preferred tunnel id from the reconnecting client.
   * @param client - Newly connected client socket.
   * @param port - Local port the client wants to expose.
   * @param now - Current epoch ms used for expiry checks.
   * @param reclaimWindowMs - Maximum age of an orphan that may still be restored.
   * @param context - Expected owner; reclaim fails when the orphan belongs elsewhere.
   * @returns The restored active record, or `undefined` when reclaim is not possible.
   */
  reclaim(
    id: string,
    client: WebSocket,
    port: number,
    now: number,
    reclaimWindowMs: number,
    context: TunnelOwnership,
  ): TunnelRecord | undefined;

  /**
   * Drops orphaned tunnels whose reclaim window has elapsed.
   *
   * @param now - Current epoch ms.
   * @param reclaimWindowMs - Maximum orphan age to retain.
   * @returns Orphans that were purged (for ownership cleanup / events).
   */
  purgeExpiredOrphans(now: number, reclaimWindowMs: number): readonly OrphanedTunnel[];

  /**
   * Looks up a tunnel by id.
   *
   * @param id - Tunnel identifier.
   * @returns The matching record, or `undefined` when absent.
   */
  findById(id: string): TunnelRecord | undefined;

  /**
   * Looks up a tunnel by its WebSocket client.
   *
   * @param client - Connected client socket.
   * @returns The matching record, or `undefined` when absent.
   */
  findByClient(client: WebSocket): TunnelRecord | undefined;

  /**
   * Looks up a tunnel by its public subdomain slug.
   *
   * @param slug - Public URL slug (see {@link import("./public-url.js").tunnelSlug}).
   * @returns The matching record, or `undefined` when absent.
   */
  findBySlug(slug: string): TunnelRecord | undefined;
}
