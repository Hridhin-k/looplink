import { randomBytes } from "node:crypto";

import { Inject, Injectable, Optional } from "@nestjs/common";
import {
  BadgerEventType,
  createEventPayload,
  EVENT_BUS,
  TUNNEL_ID_BYTES,
  TUNNEL_RECLAIM_WINDOW_MS,
  type EventBus,
} from "@hridhin-k/badger-shared";
import type WebSocket from "ws";

import { buildPublicUrl } from "./public-url.js";
import {
  contextAnonymousSessionId,
  contextWorkspaceId,
  type TunnelOwnership,
} from "./tunnel-context.js";
import { TUNNEL_REPOSITORY } from "./tunnel.constants.js";
import type { TunnelRepository } from "./tunnel.repository.js";
import type { CreatedTunnel, TunnelRecord } from "./tunnel.types.js";
import { TunnelOwnershipStore } from "./tunnel-ownership.store.js";

/** Inclusive lower bound of a valid TCP port. */
const MIN_PORT = 1;

/** Inclusive upper bound of a valid TCP port. */
const MAX_PORT = 65_535;

/**
 * Options for {@link TunnelManager.create}.
 */
export interface CreateTunnelOptions {
  /** Required logical owner of the tunnel (engine ownership ref). */
  readonly context: TunnelOwnership;
  /** Preferred tunnel id to reclaim after a reconnect. */
  readonly preferredTunnelId?: string;
  /** Epoch ms used for reclaim expiry checks. Defaults to `Date.now()`. */
  readonly now?: number;
  /** Override for the shared reclaim window. Intended for tests. */
  readonly reclaimWindowMs?: number;
  /** Account that created a workspace-scoped tunnel. */
  readonly ownerUserId?: string;
}

/**
 * Application service that manages active tunnel sessions and their WebSocket clients.
 *
 * Publishes TunnelCreated / TunnelClosed on the shared EventBus for dashboard sync
 * without changing the tunnel protocol or HTTP forward path.
 */
@Injectable()
export class TunnelManager {
  constructor(
    @Inject(TUNNEL_REPOSITORY)
    private readonly repository: TunnelRepository,
    @Inject(EVENT_BUS)
    private readonly eventBus: EventBus,
    @Optional()
    private readonly ownership?: TunnelOwnershipStore,
  ) {}

  generateTunnelId(): string {
    return randomBytes(TUNNEL_ID_BYTES).toString("hex");
  }

  create(client: WebSocket, port: number, options: CreateTunnelOptions): CreatedTunnel {
    this.assertValidPort(port);

    const now = options.now ?? Date.now();
    const reclaimWindowMs = options.reclaimWindowMs ?? TUNNEL_RECLAIM_WINDOW_MS;

    this.purgeExpired(now, reclaimWindowMs);

    if (options.preferredTunnelId !== undefined) {
      const restored = this.repository.reclaim(
        options.preferredTunnelId,
        client,
        port,
        now,
        reclaimWindowMs,
        options.context,
      );

      if (restored !== undefined) {
        this.ownership?.upsert(restored.id, restored.port, restored.context);
        const publicUrl = buildPublicUrl(restored.id);
        this.publishCreated(restored, publicUrl, true);
        return {
          tunnel: restored,
          publicUrl,
          restored: true,
        };
      }
    }

    const tunnel = this.register(client, port, options);
    const publicUrl = buildPublicUrl(tunnel.id);
    this.publishCreated(tunnel, publicUrl, false);

    return { tunnel, publicUrl, restored: false };
  }

  register(client: WebSocket, port: number, options: CreateTunnelOptions): TunnelRecord {
    const workspaceId = contextWorkspaceId(options.context);
    const anonymousSessionId = contextAnonymousSessionId(options.context);

    const tunnel: TunnelRecord = {
      id: this.generateTunnelId(),
      client,
      port,
      context: options.context,
      ...(workspaceId === undefined ? {} : { workspaceId }),
      ...(anonymousSessionId === undefined ? {} : { anonymousSessionId }),
      ...(options.ownerUserId === undefined ? {} : { ownerUserId: options.ownerUserId }),
    };

    this.repository.save(tunnel);
    this.ownership?.upsert(tunnel.id, tunnel.port, tunnel.context);
    return tunnel;
  }

  unregister(id: string): boolean {
    const existing = this.repository.findById(id);
    const removed = this.repository.remove(id);
    if (removed) {
      this.ownership?.remove(id);
      if (existing !== undefined) {
        this.publishClosed(existing.id, existing.workspaceId, "unregistered");
      }
    }
    return removed;
  }

  unregisterClient(client: WebSocket): boolean {
    const existing = this.repository.findByClient(client);
    const removed = this.repository.removeByClient(client);
    if (removed && existing !== undefined) {
      this.ownership?.remove(existing.id);
      this.publishClosed(existing.id, existing.workspaceId, "unregistered");
    }
    return removed;
  }

  detachClient(client: WebSocket): boolean {
    const orphan = this.repository.orphanByClient(client, Date.now());
    if (orphan === undefined) {
      return false;
    }
    this.publishClosed(orphan.id, orphan.workspaceId, "unregistered");
    return true;
  }

  lookup(id: string): TunnelRecord | undefined {
    return this.repository.findById(id);
  }

  lookupBySlug(slug: string): TunnelRecord | undefined {
    return this.repository.findBySlug(slug);
  }

  private purgeExpired(now: number, reclaimWindowMs: number): void {
    const purged = this.repository.purgeExpiredOrphans(now, reclaimWindowMs);
    for (const orphan of purged) {
      this.ownership?.remove(orphan.id);
      this.publishClosed(orphan.id, orphan.workspaceId, "expired");
    }
  }

  private publishCreated(tunnel: TunnelRecord, publicUrl: string, restored: boolean): void {
    this.eventBus.publish(
      BadgerEventType.TunnelCreated,
      createEventPayload({
        tunnelId: tunnel.id,
        publicUrl,
        port: tunnel.port,
        restored,
        correlationId: tunnel.id,
        ...(tunnel.workspaceId === undefined ? {} : { workspaceId: tunnel.workspaceId }),
      }),
    );
  }

  private publishClosed(
    tunnelId: string,
    workspaceId: string | undefined,
    reason: "unregistered" | "expired",
  ): void {
    this.eventBus.publish(
      BadgerEventType.TunnelClosed,
      createEventPayload({
        tunnelId,
        reason,
        correlationId: tunnelId,
        ...(workspaceId === undefined ? {} : { workspaceId }),
      }),
    );
  }

  private assertValidPort(port: number): void {
    if (!Number.isInteger(port) || port < MIN_PORT || port > MAX_PORT) {
      throw new Error(
        `Invalid port ${String(port)}: must be an integer between ${String(MIN_PORT)} and ${String(MAX_PORT)}.`,
      );
    }
  }
}
