import { randomUUID } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import type WebSocket from "ws";

import { TUNNEL_REPOSITORY } from "./tunnel.constants.js";
import type { TunnelRepository } from "./tunnel.repository.js";
import type { TunnelRecord } from "./tunnel.types.js";

/**
 * Application service that manages active tunnel sessions and their WebSocket clients.
 */
@Injectable()
export class TunnelManager {
  /**
   * @param repository - Persistence port for tunnel records.
   */
  constructor(
    @Inject(TUNNEL_REPOSITORY)
    private readonly repository: TunnelRepository,
  ) {}

  /**
   * Generates a unique tunnel identifier.
   *
   * @returns A new UUID string suitable for use as a tunnel id.
   */
  generateTunnelId(): string {
    return randomUUID();
  }

  /**
   * Registers a WebSocket client as a new tunnel session.
   *
   * @param client - Connected LoopLink client socket.
   * @returns The persisted tunnel record, including its generated id.
   */
  register(client: WebSocket): TunnelRecord {
    const tunnel: TunnelRecord = {
      id: this.generateTunnelId(),
      client,
    };

    this.repository.save(tunnel);
    return tunnel;
  }

  /**
   * Unregisters a tunnel by id.
   *
   * @param id - Tunnel identifier.
   * @returns `true` when a tunnel was removed.
   */
  unregister(id: string): boolean {
    return this.repository.remove(id);
  }

  /**
   * Unregisters the tunnel associated with a WebSocket client.
   *
   * @param client - Connected client socket.
   * @returns `true` when a tunnel was removed.
   */
  unregisterClient(client: WebSocket): boolean {
    return this.repository.removeByClient(client);
  }

  /**
   * Looks up a tunnel by id.
   *
   * @param id - Tunnel identifier.
   * @returns The matching record, or `undefined` when absent.
   */
  lookup(id: string): TunnelRecord | undefined {
    return this.repository.findById(id);
  }
}
