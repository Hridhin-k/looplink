import { describe, expect, it } from "vitest";
import type WebSocket from "ws";

import { MemoryTunnelRepository } from "./memory-tunnel.repository.js";
import { createAnonymousTunnelContext } from "./tunnel-context.js";
import type { TunnelRecord } from "./tunnel.types.js";

const ANON = createAnonymousTunnelContext("anon-session-1");

/**
 * Builds a stand-in WebSocket used only as a Map key in unit tests.
 *
 * @returns A unique object typed as {@link WebSocket}.
 */
function createClient(): WebSocket {
  return {} as WebSocket;
}

/**
 * Builds a tunnel record with anonymous ownership for repository tests.
 */
function tunnelRecord(
  id: string,
  client: WebSocket,
  port = 3000,
): TunnelRecord {
  return {
    id,
    client,
    port,
    context: ANON,
    anonymousSessionId: ANON.id,
  };
}

describe("MemoryTunnelRepository", () => {
  it("saves and finds a tunnel by id", () => {
    const repository = new MemoryTunnelRepository();
    const client = createClient();
    const tunnel = tunnelRecord("tunnel-1", client);

    repository.save(tunnel);

    expect(repository.findById("tunnel-1")).toEqual(tunnel);
  });

  it("finds a tunnel by client", () => {
    const repository = new MemoryTunnelRepository();
    const client = createClient();
    const tunnel = tunnelRecord("tunnel-2", client);

    repository.save(tunnel);

    expect(repository.findByClient(client)).toEqual(tunnel);
  });

  it("removes a tunnel by id and clears the client index", () => {
    const repository = new MemoryTunnelRepository();
    const client = createClient();
    repository.save(tunnelRecord("tunnel-3", client));

    expect(repository.remove("tunnel-3")).toBe(true);
    expect(repository.findById("tunnel-3")).toBeUndefined();
    expect(repository.findByClient(client)).toBeUndefined();
  });

  it("removes a tunnel by client", () => {
    const repository = new MemoryTunnelRepository();
    const client = createClient();
    repository.save(tunnelRecord("tunnel-4", client));

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
    const tunnel = tunnelRecord("abcd1234567890abcdef1234567890ab", client);

    repository.save(tunnel);

    expect(repository.findBySlug("abcd1234567890ab")).toEqual(tunnel);
    expect(repository.findBySlug("missing")).toBeUndefined();
  });

  it("replaces a prior record when saving the same id", () => {
    const repository = new MemoryTunnelRepository();
    const firstClient = createClient();
    const secondClient = createClient();

    repository.save(tunnelRecord("tunnel-5", firstClient, 3000));
    repository.save(tunnelRecord("tunnel-5", secondClient, 4000));

    expect(repository.findById("tunnel-5")?.client).toBe(secondClient);
    expect(repository.findById("tunnel-5")?.port).toBe(4000);
    expect(repository.findByClient(firstClient)).toBeUndefined();
    expect(repository.findByClient(secondClient)?.id).toBe("tunnel-5");
  });

  it("orphans a tunnel on disconnect and reclaims it for a new client", () => {
    const repository = new MemoryTunnelRepository();
    const firstClient = createClient();
    const secondClient = createClient();
    const tunnel = tunnelRecord("abcd1234567890abcdef1234567890ab", firstClient);

    repository.save(tunnel);

    const orphan = repository.orphanByClient(firstClient, 1_000);
    expect(orphan).toEqual({
      id: tunnel.id,
      port: 3000,
      disconnectedAt: 1_000,
      context: ANON,
      anonymousSessionId: ANON.id,
    });
    expect(repository.findById(tunnel.id)).toBeUndefined();
    expect(repository.findBySlug("abcd1234567890ab")).toBeUndefined();

    const restored = repository.reclaim(tunnel.id, secondClient, 3000, 2_000, 60_000, ANON);
    expect(restored).toEqual({
      id: tunnel.id,
      client: secondClient,
      port: 3000,
      context: ANON,
      anonymousSessionId: ANON.id,
    });
    expect(repository.findBySlug("abcd1234567890ab")).toEqual(restored);
  });

  it("does not reclaim an expired orphan", () => {
    const repository = new MemoryTunnelRepository();
    const client = createClient();
    repository.save(tunnelRecord("tunnel-6", client));
    repository.orphanByClient(client, 1_000);

    expect(
      repository.reclaim("tunnel-6", createClient(), 3000, 70_000, 60_000, ANON),
    ).toBeUndefined();
  });

  it("does not reclaim when the port does not match", () => {
    const repository = new MemoryTunnelRepository();
    const client = createClient();
    repository.save(tunnelRecord("tunnel-7", client));
    repository.orphanByClient(client, 1_000);

    expect(
      repository.reclaim("tunnel-7", createClient(), 4000, 2_000, 60_000, ANON),
    ).toBeUndefined();
  });

  it("purges expired orphans and frees their slugs", () => {
    const repository = new MemoryTunnelRepository();
    const client = createClient();
    const tunnel = tunnelRecord("abcd1234567890abcdef1234567890ab", client);

    repository.save(tunnel);
    repository.orphanByClient(client, 1_000);

    const purged = repository.purgeExpiredOrphans(70_000, 60_000);
    expect(purged).toHaveLength(1);
    expect(purged[0]?.id).toBe(tunnel.id);
    expect(
      repository.reclaim(tunnel.id, createClient(), 3000, 71_000, 60_000, ANON),
    ).toBeUndefined();
  });
});
