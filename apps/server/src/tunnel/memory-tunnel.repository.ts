import { Injectable } from "@nestjs/common";
import type WebSocket from "ws";

import type { TunnelRepository } from "./tunnel.repository.js";
import type { TunnelRecord } from "./tunnel.types.js";

/**
 * In-memory {@link TunnelRepository} backed by Maps keyed by tunnel id and client.
 */
@Injectable()
export class MemoryTunnelRepository implements TunnelRepository {
  private readonly byId = new Map<string, TunnelRecord>();
  private readonly byClient = new Map<WebSocket, string>();

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
    }

    const existingIdForClient = this.byClient.get(tunnel.client);
    if (existingIdForClient !== undefined && existingIdForClient !== tunnel.id) {
      this.byId.delete(existingIdForClient);
    }

    this.byId.set(tunnel.id, tunnel);
    this.byClient.set(tunnel.client, tunnel.id);
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
}
