import { ContextType } from "./context-type.js";
import { ContextFactory } from "./context.factory.js";
import { contextHasPermission, contextLogFields } from "./tunnel-context.interface.js";
import { ContextSessionStore } from "./providers/context-session.store.js";
import { ownershipAccountId, toTunnelOwnership } from "./to-tunnel-ownership.js";
import { describe, expect, it } from "vitest";
import type WebSocket from "ws";

describe("ContextFactory", () => {
  const factory = new ContextFactory();

  it("creates an immutable anonymous context and TunnelContext projection", () => {
    const anonymous = factory.createAnonymous({
      anonymousSessionId: "anon-1",
      expiresAt: Date.now() + 60_000,
    });

    expect(anonymous.type).toBe(ContextType.Anonymous);
    expect(anonymous.anonymousSessionId).toBe("anon-1");
    expect(anonymous.tunnelId).toBeNull();
    expect(Object.isFrozen(anonymous)).toBe(true);

    const tunnel = factory.toTunnelContext(anonymous);
    expect(tunnel.contextType).toBe(ContextType.Anonymous);
    expect(tunnel.workspaceId).toBeNull();
    expect(tunnel.anonymousSessionId).toBe("anon-1");
    expect(contextHasPermission(tunnel, "tunnel:create")).toBe(true);
    expect(contextHasPermission(tunnel, "inspector:read")).toBe(false);
    expect(Object.isFrozen(tunnel)).toBe(true);
  });

  it("creates a workspace context with resolved permissions", () => {
    const permissions = new Set(["tunnel:create", "inspector:read"] as const);
    const workspace = factory.createWorkspace({
      accountId: "acc-1",
      workspaceId: "ws-1",
      membershipId: "mem-1",
      role: "developer",
      permissions: permissions as never,
    });

    expect(workspace.type).toBe(ContextType.Workspace);
    expect(workspace.workspaceId).toBe("ws-1");
    expect(workspace.accountId).toBe("acc-1");

    const tunnel = factory.toTunnelContext(workspace);
    expect(tunnel.contextType).toBe(ContextType.Workspace);
    expect(tunnel.workspaceId).toBe("ws-1");
    expect(tunnel.anonymousSessionId).toBeNull();
    expect(contextHasPermission(tunnel, "inspector:read")).toBe(true);
    expect(ownershipAccountId(tunnel)).toBe("acc-1");
    expect(toTunnelOwnership(tunnel)).toEqual({ kind: "workspace", id: "ws-1" });
  });

  it("binds tunnel ids immutably via withTunnelId", () => {
    const base = factory.toTunnelContext(
      factory.createAnonymous({
        anonymousSessionId: "anon-2",
        expiresAt: Date.now() + 1_000,
      }),
    );
    const bound = factory.withTunnelId(base, "tun-9");
    expect(base.tunnelId).toBeNull();
    expect(bound.tunnelId).toBe("tun-9");
    expect(bound.contextId).toBe(base.contextId);
  });

  it("exposes structured log fields", () => {
    const tunnel = factory.toTunnelContext(
      factory.createWorkspace({
        accountId: "acc-1",
        workspaceId: "ws-1",
        membershipId: null,
        role: "viewer",
        permissions: new Set(["inspector:read"]) as never,
        tunnelId: "tun-1",
      }),
    );

    expect(contextLogFields(tunnel, { requestId: "req-1" })).toEqual({
      contextId: tunnel.contextId,
      tunnelId: "tun-1",
      workspaceId: "ws-1",
      requestId: "req-1",
    });
  });
});

describe("ContextSessionStore", () => {
  it("binds, replaces, and destroys websocket contexts without leaks", () => {
    const store = new ContextSessionStore();
    const factory = new ContextFactory();
    const socket = {} as WebSocket;
    const other = {} as WebSocket;

    const first = factory.toTunnelContext(
      factory.createAnonymous({
        anonymousSessionId: "a1",
        expiresAt: Date.now() + 1_000,
      }),
    );
    const second = factory.toTunnelContext(
      factory.createWorkspace({
        accountId: "u1",
        workspaceId: "w1",
        membershipId: "m1",
        role: "owner",
        permissions: new Set(["tunnel:create"]) as never,
      }),
    );

    store.bind(socket, first);
    store.bind(other, second);
    expect(store.size()).toBe(2);
    expect(store.require(socket).anonymousSessionId).toBe("a1");

    const rebound = factory.withTunnelId(first, "tun-1");
    store.replace(socket, rebound);
    expect(store.require(socket).tunnelId).toBe("tun-1");
    expect(store.require(other).workspaceId).toBe("w1");

    store.destroy(socket);
    expect(store.get(socket)).toBeUndefined();
    expect(store.size()).toBe(1);
    store.destroy(other);
    expect(store.size()).toBe(0);
  });

  it("supports concurrent anonymous and workspace contexts", () => {
    const store = new ContextSessionStore();
    const factory = new ContextFactory();
    const sockets = Array.from({ length: 50 }, () => ({}) as WebSocket);

    for (let i = 0; i < sockets.length; i += 1) {
      const socket = sockets[i];
      if (socket === undefined) {
        continue;
      }
      if (i % 2 === 0) {
        store.bind(
          socket,
          factory.toTunnelContext(
            factory.createAnonymous({
              anonymousSessionId: `anon-${String(i)}`,
              expiresAt: Date.now() + 1_000,
            }),
          ),
        );
      } else {
        store.bind(
          socket,
          factory.toTunnelContext(
            factory.createWorkspace({
              accountId: `acc-${String(i)}`,
              workspaceId: `ws-${String(i)}`,
              membershipId: `mem-${String(i)}`,
              role: "developer",
              permissions: new Set(["tunnel:create"]) as never,
            }),
          ),
        );
      }
    }

    expect(store.size()).toBe(50);
    expect(store.require(sockets[0] as WebSocket).contextType).toBe(ContextType.Anonymous);
    expect(store.require(sockets[1] as WebSocket).contextType).toBe(ContextType.Workspace);

    for (const socket of sockets) {
      store.destroy(socket);
    }
    expect(store.size()).toBe(0);
  });
});
