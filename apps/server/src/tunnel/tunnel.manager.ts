import { randomUUID } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import type WebSocket from "ws";

import { buildPublicUrl, resolvePublicBaseDomain } from "./public-url.js";
import { TUNNEL_REPOSITORY } from "./tunnel.constants.js";
import type { TunnelRepository } from "./tunnel.repository.js";
import type { CreatedTunnel, TunnelRecord } from "./tunnel.types.js";

/** Inclusive lower bound of a valid TCP port. */
const MIN_PORT = 1;

/** Inclusive upper bound of a valid TCP port. */
const MAX_PORT = 65_535;

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
   * Creates a tunnel for a connected client and local port.
   *
   * @param client - Connected LoopLink client socket.
   * @param port - Local TCP port on the client to expose.
   * @returns The persisted tunnel and its public URL.
   * @throws Error When `port` is outside the valid TCP range.
   */
  create(client: WebSocket, port: number): CreatedTunnel {
    if (!Number.isInteger(port) || port < MIN_PORT || port > MAX_PORT) {
      throw new Error(
        `Invalid port ${String(port)}: must be an integer between ${String(MIN_PORT)} and ${String(MAX_PORT)}.`,
      );
    }

    const tunnel = this.register(client, port);
    const publicUrl = buildPublicUrl(tunnel.id, resolvePublicBaseDomain());

    return { tunnel, publicUrl };
  }

  /**
   * Registers a WebSocket client as a new tunnel session.
   *
   * @param client - Connected LoopLink client socket.
   * @param port - Local TCP port on the client to expose.
   * @returns The persisted tunnel record, including its generated id.
   */
  register(client: WebSocket, port: number): TunnelRecord {
    const tunnel: TunnelRecord = {
      id: this.generateTunnelId(),
      client,
      port,
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

  /**
   * Looks up a tunnel by its public subdomain slug.
   *
   * @param slug - Public URL slug.
   * @returns The matching record, or `undefined` when absent.
   */
  lookupBySlug(slug: string): TunnelRecord | undefined {
    return this.repository.findBySlug(slug);
  }
}
