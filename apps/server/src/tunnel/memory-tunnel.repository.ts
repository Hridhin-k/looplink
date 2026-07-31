import { Injectable } from "@nestjs/common";
import type WebSocket from "ws";

import { tunnelSlug } from "./public-url.js";
import type { TunnelOwnership } from "./tunnel-context.js";
import { tunnelContextsEqual } from "./tunnel-context.js";
import type { TunnelRepository } from "./tunnel.repository.js";
import type { OrphanedTunnel, TunnelRecord } from "./tunnel.types.js";

/**
 * In-memory {@link TunnelRepository} backed by Maps keyed by id, client, and slug.
 *
 * Orphaned tunnels keep their id/slug reserved so a reconnecting client can
 * reclaim the same public URL within the reclaim window.
 */
@Injectable()
export class MemoryTunnelRepository implements TunnelRepository {
  private readonly byId = new Map<string, TunnelRecord>();
  private readonly byClient = new Map<WebSocket, string>();
  private readonly bySlug = new Map<string, string>();
  private readonly orphans = new Map<string, OrphanedTunnel>();

  /**
   * Persists a tunnel record, replacing any existing record with the same id
   * or client association.
   *
   * @param tunnel - Tunnel session to store.
   */
  save(tunnel: TunnelRecord): void {
    this.orphans.delete(tunnel.id);

    const existingById = this.byId.get(tunnel.id);
    if (existingById !== undefined) {
      this.byClient.delete(existingById.client);
      this.bySlug.delete(tunnelSlug(existingById.id));
    }

    const existingIdForClient = this.byClient.get(tunnel.client);
    if (existingIdForClient !== undefined && existingIdForClient !== tunnel.id) {
      const displaced = this.byId.get(existingIdForClient);
      this.byId.delete(existingIdForClient);
      if (displaced !== undefined) {
        this.bySlug.delete(tunnelSlug(displaced.id));
      }
    }

    this.byId.set(tunnel.id, tunnel);
    this.byClient.set(tunnel.client, tunnel.id);
    this.bySlug.set(tunnelSlug(tunnel.id), tunnel.id);
  }

  /**
   * Removes a tunnel by id.
   *
   * @param id - Tunnel identifier.
   * @returns `true` when a record was removed.
   */
  remove(id: string): boolean {
    const orphanRemoved = this.orphans.delete(id);
    const existing = this.byId.get(id);
    if (existing === undefined) {
      if (orphanRemoved) {
        this.bySlug.delete(tunnelSlug(id));
      }
      return orphanRemoved;
    }

    this.byId.delete(id);
    this.byClient.delete(existing.client);
    this.bySlug.delete(tunnelSlug(existing.id));
    return true;
  }

  /**
   * Removes the tunnel associated with a WebSocket client.
   *
   * @param client - Connected client socket.
   * @returns `true` when a record was removed.
   */
  removeByClient(client: WebSocket): boolean {
    const id = this.byClient.get(client);
    if (id === undefined) {
      return false;
    }

    return this.remove(id);
  }

  /**
   * Detaches a client and parks its tunnel as reclaimable.
   *
   * @param client - Disconnecting client socket.
   * @param disconnectedAt - Epoch ms of the disconnect.
   * @returns The orphaned tunnel, or `undefined` when the client had none.
   */
  orphanByClient(client: WebSocket, disconnectedAt: number): OrphanedTunnel | undefined {
    const id = this.byClient.get(client);
    if (id === undefined) {
      return undefined;
    }

    const existing = this.byId.get(id);
    if (existing === undefined) {
      this.byClient.delete(client);
      return undefined;
    }

    this.byId.delete(id);
    this.byClient.delete(client);

    const orphan: OrphanedTunnel = {
      id: existing.id,
      port: existing.port,
      disconnectedAt,
      context: existing.context,
      ...(existing.ownerUserId === undefined ? {} : { ownerUserId: existing.ownerUserId }),
      ...(existing.workspaceId === undefined ? {} : { workspaceId: existing.workspaceId }),
      ...(existing.anonymousSessionId === undefined
        ? {}
        : { anonymousSessionId: existing.anonymousSessionId }),
    };

    this.orphans.set(id, orphan);
    // Slug stays reserved so the public URL cannot be handed to another tunnel.
    return orphan;
  }

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
  ): TunnelRecord | undefined {
    const orphan = this.orphans.get(id);
    if (orphan === undefined) {
      return undefined;
    }

    if (orphan.port !== port) {
      return undefined;
    }

    if (!tunnelContextsEqual(orphan.context, context)) {
      return undefined;
    }

    if (now - orphan.disconnectedAt > reclaimWindowMs) {
      this.orphans.delete(id);
      this.bySlug.delete(tunnelSlug(id));
      return undefined;
    }

    this.orphans.delete(id);

    const tunnel: TunnelRecord = {
      id: orphan.id,
      client,
      port: orphan.port,
      context: orphan.context,
      ...(orphan.ownerUserId === undefined ? {} : { ownerUserId: orphan.ownerUserId }),
      ...(orphan.workspaceId === undefined ? {} : { workspaceId: orphan.workspaceId }),
      ...(orphan.anonymousSessionId === undefined
        ? {}
        : { anonymousSessionId: orphan.anonymousSessionId }),
    };

    this.save(tunnel);
    return tunnel;
  }

  /**
   * Drops orphaned tunnels whose reclaim window has elapsed.
   *
   * @param now - Current epoch ms.
   * @param reclaimWindowMs - Maximum orphan age to retain.
   * @returns Orphans that were purged.
   */
  purgeExpiredOrphans(now: number, reclaimWindowMs: number): readonly OrphanedTunnel[] {
    const purged: OrphanedTunnel[] = [];

    for (const [id, orphan] of this.orphans) {
      if (now - orphan.disconnectedAt <= reclaimWindowMs) {
        continue;
      }

      this.orphans.delete(id);
      this.bySlug.delete(tunnelSlug(id));
      purged.push(orphan);
    }

    return purged;
  }

  /**
   * Looks up a tunnel by id.
   *
   * @param id - Tunnel identifier.
   * @returns The matching record, or `undefined` when absent.
   */
  findById(id: string): TunnelRecord | undefined {
    return this.byId.get(id);
  }

  /**
   * Looks up a tunnel by its WebSocket client.
   *
   * @param client - Connected client socket.
   * @returns The matching record, or `undefined` when absent.
   */
  findByClient(client: WebSocket): TunnelRecord | undefined {
    const id = this.byClient.get(client);
    if (id === undefined) {
      return undefined;
    }

    return this.byId.get(id);
  }

  /**
   * Looks up a tunnel by its public subdomain slug.
   *
   * Active tunnels only — orphans keep the slug reserved but are not routable.
   *
   * @param slug - Public URL slug.
   * @returns The matching record, or `undefined` when absent.
   */
  findBySlug(slug: string): TunnelRecord | undefined {
    const id = this.bySlug.get(slug.toLowerCase());
    if (id === undefined) {
      return undefined;
    }

    return this.byId.get(id);
  }
}
