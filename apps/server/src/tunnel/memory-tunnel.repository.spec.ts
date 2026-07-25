import { describe, expect, it } from "vitest";
import type WebSocket from "ws";

import { MemoryTunnelRepository } from "./memory-tunnel.repository.js";
import type { TunnelRecord } from "./tunnel.types.js";

/**
 * Builds a stand-in WebSocket used only as a Map key in unit tests.
 *
 * @returns A unique object typed as {@link WebSocket}.
 */
function createClient(): WebSocket {
  return {} as WebSocket;
}

describe("MemoryTunnelRepository", () => {
  it("saves and finds a tunnel by id", () => {
    const repository = new MemoryTunnelRepository();
    const client = createClient();
    const tunnel: TunnelRecord = { id: "tunnel-1", client, port: 3000 };

    repository.save(tunnel);

    expect(repository.findById("tunnel-1")).toEqual(tunnel);
  });

  it("finds a tunnel by client", () => {
    const repository = new MemoryTunnelRepository();
    const client = createClient();
    const tunnel: TunnelRecord = { id: "tunnel-2", client, port: 3000 };

    repository.save(tunnel);

    expect(repository.findByClient(client)).toEqual(tunnel);
  });

  it("removes a tunnel by id and clears the client index", () => {
    const repository = new MemoryTunnelRepository();
    const client = createClient();
    repository.save({ id: "tunnel-3", client, port: 3000 });

    expect(repository.remove("tunnel-3")).toBe(true);
    expect(repository.findById("tunnel-3")).toBeUndefined();
    expect(repository.findByClient(client)).toBeUndefined();
  });

  it("removes a tunnel by client", () => {
    const repository = new MemoryTunnelRepository();
    const client = createClient();
    repository.save({ id: "tunnel-4", client, port: 3000 });

    expect(repository.removeByClient(client)).toBe(true);
    expect(repository.findById("tunnel-4")).toBeUndefined();
  });

  it("returns false when removing an unknown id or client", () => {
    const repository = new MemoryTunnelRepository();

    expect(repository.remove("missing")).toBe(false);
    expect(repository.removeByClient(createClient())).toBe(false);
  });

  it("finds a tunnel by slug", () => {
    const repository = new MemoryTunnelRepository();
    const client = createClient();
    const tunnel: TunnelRecord = {
      id: "abcd1234567890abcdef1234567890ab",
      client,
      port: 3000,
    };

    repository.save(tunnel);

    expect(repository.findBySlug("abcd1234567890ab")).toEqual(tunnel);
    expect(repository.findBySlug("missing")).toBeUndefined();
  });

  it("replaces a prior record when saving the same id", () => {
    const repository = new MemoryTunnelRepository();
    const firstClient = createClient();
    const secondClient = createClient();

    repository.save({ id: "tunnel-5", client: firstClient, port: 3000 });
    repository.save({ id: "tunnel-5", client: secondClient, port: 4000 });

    expect(repository.findById("tunnel-5")?.client).toBe(secondClient);
    expect(repository.findById("tunnel-5")?.port).toBe(4000);
    expect(repository.findByClient(firstClient)).toBeUndefined();
    expect(repository.findByClient(secondClient)?.id).toBe("tunnel-5");
  });

  it("orphans a tunnel on disconnect and reclaims it for a new client", () => {
    const repository = new MemoryTunnelRepository();
    const firstClient = createClient();
    const secondClient = createClient();
    const tunnel: TunnelRecord = {
      id: "abcd1234567890abcdef1234567890ab",
      client: firstClient,
      port: 3000,
    };

    repository.save(tunnel);

    const orphan = repository.orphanByClient(firstClient, 1_000);
    expect(orphan).toEqual({
      id: tunnel.id,
      port: 3000,
      disconnectedAt: 1_000,
    });
    expect(repository.findById(tunnel.id)).toBeUndefined();
    expect(repository.findBySlug("abcd1234567890ab")).toBeUndefined();

    const restored = repository.reclaim(tunnel.id, secondClient, 3000, 2_000, 60_000);
    expect(restored).toEqual({
      id: tunnel.id,
      client: secondClient,
      port: 3000,
    });
    expect(repository.findBySlug("abcd1234567890ab")).toEqual(restored);
  });

  it("does not reclaim an expired orphan", () => {
    const repository = new MemoryTunnelRepository();
    const client = createClient();
    repository.save({ id: "tunnel-6", client, port: 3000 });
    repository.orphanByClient(client, 1_000);

    expect(repository.reclaim("tunnel-6", createClient(), 3000, 70_000, 60_000)).toBeUndefined();
  });

  it("does not reclaim when the port does not match", () => {
    const repository = new MemoryTunnelRepository();
    const client = createClient();
    repository.save({ id: "tunnel-7", client, port: 3000 });
    repository.orphanByClient(client, 1_000);

    expect(repository.reclaim("tunnel-7", createClient(), 4000, 2_000, 60_000)).toBeUndefined();
  });

  it("purges expired orphans and frees their slugs", () => {
    const repository = new MemoryTunnelRepository();
    const client = createClient();
    const tunnel: TunnelRecord = {
      id: "abcd1234567890abcdef1234567890ab",
      client,
      port: 3000,
    };

    repository.save(tunnel);
    repository.orphanByClient(client, 1_000);

    expect(repository.purgeExpiredOrphans(70_000, 60_000)).toBe(1);
    expect(repository.reclaim(tunnel.id, createClient(), 3000, 71_000, 60_000)).toBeUndefined();
  });
});
