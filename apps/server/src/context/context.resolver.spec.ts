import { ForbiddenException, UnauthorizedException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";
import type { IncomingMessage } from "node:http";

import { ContextFactory } from "./context.factory.js";
import { ContextResolver } from "./context.resolver.js";
import { ContextType } from "./context-type.js";
import { contextHasPermission } from "./tunnel-context.interface.js";

function createResolver(overrides: {
  readonly auth?: { verifyAccessToken: ReturnType<typeof vi.fn> };
  readonly apiKeys?: { verifyBearerToken: ReturnType<typeof vi.fn> };
  readonly workspaceContext?: { resolve: ReturnType<typeof vi.fn> };
  readonly anonymousSessions?: { validate: ReturnType<typeof vi.fn> };
} = {}): ContextResolver {
  return new ContextResolver(
    new ContextFactory(),
    (overrides.auth ?? {
      verifyAccessToken: vi.fn().mockResolvedValue({ id: "u1", email: "a@b.com" }),
    }) as never,
    (overrides.apiKeys ?? { verifyBearerToken: vi.fn() }) as never,
    (overrides.workspaceContext ?? {
      resolve: vi.fn().mockResolvedValue({
        request: {
          accountId: "u1",
          accountEmail: "a@b.com",
          authMethod: "jwt",
          workspaceId: "ws-1",
          membershipId: "mem-1",
          role: "owner",
          permissions: new Set(["tunnel:create", "inspector:read", "inspector:replay"]),
        },
        workspace: { id: "ws-1" },
      }),
    }) as never,
    (overrides.anonymousSessions ?? {
      validate: vi.fn().mockResolvedValue({
        id: "anon-1",
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + 60_000).toISOString(),
        lastSeenAt: new Date().toISOString(),
      }),
    }) as never,
  );
}

describe("ContextResolver", () => {
  it("resolves anonymous sessions into TunnelContext", async () => {
    const resolver = createResolver();
    const context = await resolver.resolve({
      anonymousSessionToken: "bga_test",
    });

    expect(context.contextType).toBe(ContextType.Anonymous);
    expect(context.anonymousSessionId).toBe("anon-1");
    expect(context.workspaceId).toBeNull();
    expect(contextHasPermission(context, "tunnel:create")).toBe(true);
  });

  it("resolves authenticated workspace membership into TunnelContext", async () => {
    const resolver = createResolver();
    const context = await resolver.resolveAuthenticated(
      { id: "u1", email: "a@b.com", authMethod: "jwt" },
      "ws-1",
    );

    expect(context.contextType).toBe(ContextType.Workspace);
    expect(context.workspaceId).toBe("ws-1");
    expect(contextHasPermission(context, "inspector:read")).toBe(true);
  });

  it("resolves tunnel websocket headers for workspace JWT", async () => {
    const resolver = createResolver();
    const request = {
      headers: {
        authorization: "Bearer jwt-token",
        "x-workspace-id": "ws-1",
      },
    } as unknown as IncomingMessage;

    const context = await resolver.resolveTunnelWebSocket(request);
    expect(context.contextType).toBe(ContextType.Workspace);
    expect(context.metadata["transport"]).toBe("tunnel_ws");
  });

  it("resolves tunnel websocket headers for anonymous sessions", async () => {
    const resolver = createResolver();
    const request = {
      headers: {
        "x-anonymous-session": "bga_test",
      },
    } as unknown as IncomingMessage;

    const context = await resolver.resolveTunnelWebSocket(request);
    expect(context.contextType).toBe(ContextType.Anonymous);
  });

  it("rejects missing credentials", async () => {
    const resolver = createResolver();
    await expect(resolver.resolve({})).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it("enforces permissions from the immutable set", async () => {
    const resolver = createResolver({
      workspaceContext: {
        resolve: vi.fn().mockResolvedValue({
          request: {
            accountId: "u1",
            accountEmail: null,
            authMethod: "jwt",
            workspaceId: "ws-1",
            membershipId: "mem-1",
            role: "viewer",
            permissions: new Set(["inspector:read"]),
          },
          workspace: { id: "ws-1" },
        }),
      },
    });

    const context = await resolver.resolveAuthenticated(
      { id: "u1", email: null, authMethod: "jwt" },
      "ws-1",
    );

    expect(() => resolver.requirePermission(context, "inspector:read")).not.toThrow();
    expect(() => resolver.requirePermission(context, "tunnel:create")).toThrow(
      ForbiddenException,
    );
  });

  it("switches workspace preference without leaking prior context", async () => {
    const resolve = vi
      .fn()
      .mockResolvedValueOnce({
        request: {
          accountId: "u1",
          accountEmail: null,
          authMethod: "jwt",
          workspaceId: "ws-a",
          membershipId: "m-a",
          role: "owner",
          permissions: new Set(["tunnel:create"]),
        },
        workspace: { id: "ws-a" },
      })
      .mockResolvedValueOnce({
        request: {
          accountId: "u1",
          accountEmail: null,
          authMethod: "jwt",
          workspaceId: "ws-b",
          membershipId: "m-b",
          role: "developer",
          permissions: new Set(["tunnel:create", "inspector:read"]),
        },
        workspace: { id: "ws-b" },
      });

    const resolver = createResolver({ workspaceContext: { resolve } });
    const user = { id: "u1", email: null, authMethod: "jwt" as const };

    const first = await resolver.resolveAuthenticated(user, "ws-a");
    const second = await resolver.resolveAuthenticated(user, "ws-b");

    expect(first.workspaceId).toBe("ws-a");
    expect(second.workspaceId).toBe("ws-b");
    expect(first.contextId).not.toBe(second.contextId);
    expect(contextHasPermission(first, "inspector:read")).toBe(false);
    expect(contextHasPermission(second, "inspector:read")).toBe(true);
  });
});
