import { BadgerEventType, createEventBus, type EventBus } from "@hridhin-k/badger-shared";
import { describe, expect, it, vi } from "vitest";
import type WebSocket from "ws";

import { MemoryTunnelRepository } from "./memory-tunnel.repository.js";
import { TunnelManager } from "./tunnel.manager.js";
import type { TunnelRepository } from "./tunnel.repository.js";
import type { TunnelRecord } from "./tunnel.types.js";

/**
 * Builds a stand-in WebSocket used only as a Map key in unit tests.
 *
 * @returns A unique object typed as {@link WebSocket}.
 */
function createClient(): WebSocket {
  return {} as WebSocket;
}

/**
 * Builds a {@link TunnelManager} with an optional shared event bus.
 *
 * @param repository - Persistence port.
 * @param eventBus - Lifecycle bus; defaults to a fresh in-memory bus.
 * @returns Configured manager.
 */
function createManager(
  repository: TunnelRepository = new MemoryTunnelRepository(),
  eventBus: EventBus = createEventBus(),
): TunnelManager {
  return new TunnelManager(repository, eventBus);
}

describe("TunnelManager", () => {
  it("generates unique cryptographically random tunnel ids", () => {
    const manager = createManager();

    const first = manager.generateTunnelId();
    const second = manager.generateTunnelId();

    expect(first).not.toBe(second);
    expect(first).toMatch(/^[0-9a-f]{32}$/);
    expect(second).toMatch(/^[0-9a-f]{32}$/);
  });

  it("registers a websocket client and returns a persisted tunnel", () => {
    const repository = new MemoryTunnelRepository();
    const manager = createManager(repository);
    const client = createClient();

    const tunnel = manager.register(client, 3000);

    expect(tunnel.client).toBe(client);
    expect(tunnel.port).toBe(3000);
    expect(tunnel.id.length).toBeGreaterThan(0);
    expect(manager.lookup(tunnel.id)).toEqual(tunnel);
  });

  it("creates a tunnel with a public URL", () => {
    const manager = createManager();
    vi.spyOn(manager, "generateTunnelId").mockReturnValue("abcd1234567890abcdef1234567890ab");

    const created = manager.create(createClient(), 3000);

    expect(created.tunnel.port).toBe(3000);
    expect(created.tunnel.id).toBe("abcd1234567890abcdef1234567890ab");
    expect(created.publicUrl).toBe("https://badger.dev/tunnel/abcd1234567890abcdef1234567890ab");
    expect(created.restored).toBe(false);
  });

  it("emits TunnelCreated when a tunnel is created", () => {
    const eventBus = createEventBus();
    const createdEvents: unknown[] = [];
    eventBus.subscribe(BadgerEventType.TunnelCreated, (payload) => {
      createdEvents.push(payload);
    });

    const manager = createManager(new MemoryTunnelRepository(), eventBus);
    vi.spyOn(manager, "generateTunnelId").mockReturnValue("abcd1234567890abcdef1234567890ab");

    manager.create(createClient(), 3000);

    expect(createdEvents).toEqual([
      expect.objectContaining({
        tunnelId: "abcd1234567890abcdef1234567890ab",
        port: 3000,
        restored: false,
      }),
    ]);
  });

  it("creates subdomain public URLs when BADGER_PUBLIC_URL_MODE=subdomain", () => {
    process.env["BADGER_PUBLIC_URL_MODE"] = "subdomain";
    try {
      const manager = createManager();
      vi.spyOn(manager, "generateTunnelId").mockReturnValue("abcd1234567890abcdef1234567890ab");

      const created = manager.create(createClient(), 3000);

      expect(created.publicUrl).toBe("https://abcd1234567890ab.badger.dev");
    } finally {
      delete process.env["BADGER_PUBLIC_URL_MODE"];
    }
  });

  it("reclaims an orphaned tunnel when a preferred id is provided", () => {
    const manager = createManager();
    vi.spyOn(manager, "generateTunnelId").mockReturnValue("abcd1234567890abcdef1234567890ab");

    const firstClient = createClient();
    const created = manager.create(firstClient, 3000);
    expect(manager.detachClient(firstClient)).toBe(true);
    expect(manager.lookup(created.tunnel.id)).toBeUndefined();

    const secondClient = createClient();
    const restored = manager.create(secondClient, 3000, {
      preferredTunnelId: created.tunnel.id,
    });

    expect(restored.restored).toBe(true);
    expect(restored.tunnel.id).toBe(created.tunnel.id);
    expect(restored.publicUrl).toBe(created.publicUrl);
    expect(restored.tunnel.client).toBe(secondClient);
  });

  it("creates a new tunnel when the preferred id cannot be reclaimed", () => {
    const manager = createManager();
    vi.spyOn(manager, "generateTunnelId").mockReturnValue("ffff9999567890abcdef1234567890ab");

    const created = manager.create(createClient(), 3000, {
      preferredTunnelId: "missing-id",
    });

    expect(created.restored).toBe(false);
    expect(created.tunnel.id).toBe("ffff9999567890abcdef1234567890ab");
  });

  it("rejects invalid ports when creating a tunnel", () => {
    const manager = createManager();

    expect(() => manager.create(createClient(), 0)).toThrow(/Invalid port/);
    expect(() => manager.create(createClient(), 70_000)).toThrow(/Invalid port/);
  });

  it("looks up a tunnel by id", () => {
    const manager = createManager();
    const tunnel = manager.register(createClient(), 3000);

    expect(manager.lookup(tunnel.id)).toEqual(tunnel);
    expect(manager.lookup("missing")).toBeUndefined();
  });

  it("unregisters a tunnel by id", () => {
    const manager = createManager();
    const tunnel = manager.register(createClient(), 3000);

    expect(manager.unregister(tunnel.id)).toBe(true);
    expect(manager.lookup(tunnel.id)).toBeUndefined();
    expect(manager.unregister(tunnel.id)).toBe(false);
  });

  it("emits TunnelClosed when a tunnel is unregistered", () => {
    const eventBus = createEventBus();
    const closed: unknown[] = [];
    eventBus.subscribe(BadgerEventType.TunnelClosed, (payload) => {
      closed.push(payload);
    });

    const manager = createManager(new MemoryTunnelRepository(), eventBus);
    const tunnel = manager.register(createClient(), 3000);

    manager.unregister(tunnel.id);

    expect(closed).toEqual([
      expect.objectContaining({
        tunnelId: tunnel.id,
        reason: "unregistered",
      }),
    ]);
  });

  it("emits TunnelClosed when expired orphans are purged during create", () => {
    const eventBus = createEventBus();
    const closed: unknown[] = [];
    eventBus.subscribe(BadgerEventType.TunnelClosed, (payload) => {
      closed.push(payload);
    });

    const repository = new MemoryTunnelRepository();
    const manager = createManager(repository, eventBus);
    vi.spyOn(manager, "generateTunnelId")
      .mockReturnValueOnce("abcd1234567890abcdef1234567890ab")
      .mockReturnValueOnce("ffff9999567890abcdef1234567890ab");

    const firstClient = createClient();
    const created = manager.create(firstClient, 3000);
    expect(manager.detachClient(firstClient)).toBe(true);

    const now = Date.now() + 70_000;
    manager.create(createClient(), 3001, {
      now,
      reclaimWindowMs: 60_000,
    });

    expect(closed).toEqual([
      expect.objectContaining({
        tunnelId: created.tunnel.id,
        reason: "expired",
      }),
    ]);
  });

  it("unregisters a tunnel by websocket client", () => {
    const manager = createManager();
    const client = createClient();
    const tunnel = manager.register(client, 3000);

    expect(manager.unregisterClient(client)).toBe(true);
    expect(manager.lookup(tunnel.id)).toBeUndefined();
    expect(manager.unregisterClient(client)).toBe(false);
  });

  it("detaches a client without deleting the reclaimable orphan", () => {
    const manager = createManager();
    const client = createClient();
    const tunnel = manager.register(client, 3000);

    expect(manager.detachClient(client)).toBe(true);
    expect(manager.lookup(tunnel.id)).toBeUndefined();
    expect(manager.detachClient(client)).toBe(false);
  });

  it("delegates persistence to the injected repository", () => {
    const client = createClient();
    const tunnel: TunnelRecord = { id: "fixed-id", client, port: 3000 };

    const repository: TunnelRepository = {
      save: vi.fn(),
      remove: vi.fn(() => true),
      removeByClient: vi.fn(() => true),
      orphanByClient: vi.fn(() => ({
        id: "fixed-id",
        port: 3000,
        disconnectedAt: 0,
      })),
      reclaim: vi.fn(() => undefined),
      purgeExpiredOrphans: vi.fn(() => []),
      findById: vi.fn(() => tunnel),
      findByClient: vi.fn(() => tunnel),
      findBySlug: vi.fn(() => tunnel),
    };

    const manager = createManager(repository);
    vi.spyOn(manager, "generateTunnelId").mockReturnValue("fixed-id");

    expect(manager.register(client, 3000)).toEqual(tunnel);
    expect(repository.save).toHaveBeenCalledWith(tunnel);

    expect(manager.lookup("fixed-id")).toEqual(tunnel);
    expect(repository.findById).toHaveBeenCalledWith("fixed-id");

    expect(manager.unregister("fixed-id")).toBe(true);
    expect(repository.remove).toHaveBeenCalledWith("fixed-id");

    expect(manager.unregisterClient(client)).toBe(true);
    expect(repository.removeByClient).toHaveBeenCalledWith(client);

    expect(manager.detachClient(client)).toBe(true);
    expect(repository.orphanByClient).toHaveBeenCalled();
  });
});
