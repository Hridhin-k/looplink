import { randomBytes } from "node:crypto";

import { Inject, Injectable } from "@nestjs/common";
import {
  BadgerEventType,
  EVENT_BUS,
  TUNNEL_ID_BYTES,
  TUNNEL_RECLAIM_WINDOW_MS,
  type EventBus,
} from "@hridhin-k/badger-shared";
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
}

/**
 * Application service that manages active tunnel sessions and their WebSocket clients.
 */
@Injectable()
export class TunnelManager {
  /**
   * @param repository - Persistence port for tunnel records.
   * @param eventBus - Lifecycle event bus (fire-and-forget; never affects control flow).
   */
  constructor(
    @Inject(TUNNEL_REPOSITORY)
    private readonly repository: TunnelRepository,
    @Inject(EVENT_BUS)
    private readonly eventBus: EventBus,
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

    this.emitExpiredClosures(this.repository.purgeExpiredOrphans(now, reclaimWindowMs));

    if (options.preferredTunnelId !== undefined) {
      const restored = this.repository.reclaim(
        options.preferredTunnelId,
        client,
        port,
        now,
        reclaimWindowMs,
      );

      if (restored !== undefined) {
        const publicUrl = buildPublicUrl(restored.id);
        this.eventBus.publish(BadgerEventType.TunnelCreated, {
          tunnelId: restored.id,
          publicUrl,
          port: restored.port,
          restored: true,
          occurredAt: Date.now(),
        });
        return {
          tunnel: restored,
          publicUrl,
          restored: true,
        };
      }
    }

    const tunnel = this.register(client, port);
    const publicUrl = buildPublicUrl(tunnel.id);

    this.eventBus.publish(BadgerEventType.TunnelCreated, {
      tunnelId: tunnel.id,
      publicUrl,
      port: tunnel.port,
      restored: false,
      occurredAt: Date.now(),
    });

    return { tunnel, publicUrl, restored: false };
  }

  /**
   * Registers a WebSocket client as a new tunnel session.
   *
   * @param client - Connected Badger client socket.
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
    const removed = this.repository.remove(id);
    if (removed) {
      this.eventBus.publish(BadgerEventType.TunnelClosed, {
        tunnelId: id,
        reason: "unregistered",
        occurredAt: Date.now(),
      });
    }
    return removed;
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
    const existing = this.repository.findByClient(client);
    const removed = this.repository.removeByClient(client);
    if (removed && existing !== undefined) {
      this.eventBus.publish(BadgerEventType.TunnelClosed, {
        tunnelId: existing.id,
        reason: "unregistered",
        occurredAt: Date.now(),
      });
    }
    return removed;
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

  /**
   * Looks up the active tunnel bound to a WebSocket client.
   *
   * @param client - Connected client socket.
   * @returns The matching record, or `undefined` when absent.
   */
  lookupByClient(client: WebSocket): TunnelRecord | undefined {
    return this.repository.findByClient(client);
  }

  private emitExpiredClosures(purgedIds: readonly string[]): void {
    const occurredAt = Date.now();
    for (const tunnelId of purgedIds) {
      this.eventBus.publish(BadgerEventType.TunnelClosed, {
        tunnelId,
        reason: "expired",
        occurredAt,
      });
    }
  }

  private assertValidPort(port: number): void {
    if (!Number.isInteger(port) || port < MIN_PORT || port > MAX_PORT) {
      throw new Error(
        `Invalid port ${String(port)}: must be an integer between ${String(MIN_PORT)} and ${String(MAX_PORT)}.`,
      );
    }
  }
}
