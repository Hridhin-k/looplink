import { randomBytes } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import { TUNNEL_ID_BYTES, TUNNEL_RECLAIM_WINDOW_MS } from "@hridhin-k/badger-shared";
import type WebSocket from "ws";

import { buildPublicUrl } from "./public-url.js";
import { TUNNEL_REPOSITORY } from "./tunnel.constants.js";
import type { TunnelRepository } from "./tunnel.repository.js";
import type { CreatedTunnel, TunnelRecord } from "./tunnel.types.js";

/** Inclusive lower bound of a valid TCP port. */
const MIN_PORT = 1;

/** Inclusive upper bound of a valid TCP port. */
const MAX_PORT = 65_535;

/**
 * Options for {@link TunnelManager.create}.
 */
export interface CreateTunnelOptions {
  /** Preferred tunnel id to reclaim after a reconnect. */
  readonly preferredTunnelId?: string;
  /** Epoch ms used for reclaim expiry checks. Defaults to `Date.now()`. */
  readonly now?: number;
  /** Override for the shared reclaim window. Intended for tests. */
  readonly reclaimWindowMs?: number;
  /** Authenticated owner of this tunnel (legacy: absent). */
  readonly ownerUserId?: string;
  /** Workspace that owns this tunnel (legacy: absent). */
  readonly workspaceId?: string;
}

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
   * Generates a cryptographically secure tunnel identifier.
   *
   * Uses {@link randomBytes} (not `Math.random`) so public URL slugs derived
   * from the id are not predictable.
   *
   * @returns A hex string of length `TUNNEL_ID_BYTES * 2`.
   */
  generateTunnelId(): string {
    return randomBytes(TUNNEL_ID_BYTES).toString("hex");
  }

  /**
   * Creates a tunnel for a connected client and local port.
   *
   * When `preferredTunnelId` is provided, the manager first tries to reclaim an
   * orphaned tunnel so the public URL survives a brief network interruption.
   *
   * @param client - Connected Badger client socket.
   * @param port - Local TCP port on the client to expose.
   * @param options - Optional reclaim preference and clock overrides.
   * @returns The persisted tunnel and its public URL.
   * @throws Error When `port` is outside the valid TCP range.
   */
  create(client: WebSocket, port: number, options: CreateTunnelOptions = {}): CreatedTunnel {
    this.assertValidPort(port);

    const now = options.now ?? Date.now();
    const reclaimWindowMs = options.reclaimWindowMs ?? TUNNEL_RECLAIM_WINDOW_MS;

    this.repository.purgeExpiredOrphans(now, reclaimWindowMs);

    if (options.preferredTunnelId !== undefined) {
      const restored = this.repository.reclaim(
        options.preferredTunnelId,
        client,
        port,
        now,
        reclaimWindowMs,
      );

      if (restored !== undefined) {
        return {
          tunnel: restored,
          publicUrl: buildPublicUrl(restored.id),
          restored: true,
        };
      }
    }

    const tunnel = this.register(client, port, options);
    const publicUrl = buildPublicUrl(tunnel.id);

    return { tunnel, publicUrl, restored: false };
  }

  /**
   * Registers a WebSocket client as a new tunnel session.
   *
   * @param client - Connected Badger client socket.
   * @param port - Local TCP port on the client to expose.
   * @returns The persisted tunnel record, including its generated id.
   */
  register(client: WebSocket, port: number, options: CreateTunnelOptions = {}): TunnelRecord {
    const tunnel: TunnelRecord = {
      id: this.generateTunnelId(),
      client,
      port,
      ...(options.ownerUserId === undefined ? {} : { ownerUserId: options.ownerUserId }),
      ...(options.workspaceId === undefined ? {} : { workspaceId: options.workspaceId }),
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
   * Prefer {@link detachClient} on unexpected disconnects so the tunnel can be
   * reclaimed after a reconnect.
   *
   * @param client - Connected client socket.
   * @returns `true` when a tunnel was removed.
   */
  unregisterClient(client: WebSocket): boolean {
    return this.repository.removeByClient(client);
  }

  /**
   * Parks the client's tunnel as reclaimable instead of deleting it.
   *
   * @param client - Disconnecting client socket.
   * @returns `true` when a tunnel was orphaned.
   */
  detachClient(client: WebSocket): boolean {
    return this.repository.orphanByClient(client, Date.now()) !== undefined;
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

  private assertValidPort(port: number): void {
    if (!Number.isInteger(port) || port < MIN_PORT || port > MAX_PORT) {
      throw new Error(
        `Invalid port ${String(port)}: must be an integer between ${String(MIN_PORT)} and ${String(MAX_PORT)}.`,
      );
    }
  }
}
