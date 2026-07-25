import { Injectable } from "@nestjs/common";
import type WebSocket from "ws";

import { tunnelSlug } from "./public-url.js";
import type { TunnelRepository } from "./tunnel.repository.js";
import type { TunnelRecord } from "./tunnel.types.js";

/**
 * In-memory {@link TunnelRepository} backed by Maps keyed by id, client, and slug.
 */
@Injectable()
export class MemoryTunnelRepository implements TunnelRepository {
  private readonly byId = new Map<string, TunnelRecord>();
  private readonly byClient = new Map<WebSocket, string>();
  private readonly bySlug = new Map<string, string>();

  /**
   * Persists a tunnel record, replacing any existing record with the same id
   * or client association.
   *
   * @param tunnel - Tunnel session to store.
   */
  save(tunnel: TunnelRecord): void {
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
    const existing = this.byId.get(id);
    if (existing === undefined) {
      return false;
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
