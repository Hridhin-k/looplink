import type WebSocket from "ws";

import type { TunnelRecord } from "./tunnel.types.js";

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
}
