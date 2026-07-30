import { EventEmitter } from "node:events";
import type { IncomingMessage } from "node:http";
import { Socket } from "node:net";

import { MessageType } from "@hridhin-k/badger-shared";
import { describe, expect, it, vi } from "vitest";
import WebSocket from "ws";

import { HeartbeatMonitor } from "./heartbeat.monitor.js";
import { TunnelGateway } from "./tunnel.gateway.js";
import { HttpExchangeCoordinator } from "../http-forward/http-exchange.coordinator.js";
import { GatewaySecurityPolicy } from "../security/gateway-security.policy.js";
import { OriginValidator } from "../security/origin-validator.js";
import { resolveSecurityConfig } from "../security/security.config.js";
import type { TunnelManager } from "../tunnel/tunnel.manager.js";

class FakeSocket extends EventEmitter {
  readyState = WebSocket.OPEN;
  readonly sent: string[] = [];
  readonly terminate = vi.fn();
  readonly close = vi.fn();

  send(data: string): void {
    this.sent.push(data);
  }

  /** Parsed protocol payloads written to this socket, in send order. */
  sentMessages(): { type: string; requestId?: string; code?: string }[] {
    return this.sent.map(
      (raw) => JSON.parse(raw) as { type: string; requestId?: string; code?: string },
    );
  }
}

function createGateway(): {
  gateway: TunnelGateway;
  heartbeats: HeartbeatMonitor;
  tunnelManager: TunnelManager;
  security: GatewaySecurityPolicy;
} {
  const auth = {
    verifyAccessToken: vi.fn().mockResolvedValue({ id: "u1", email: null, authMethod: "jwt" }),
  };
  const apiKeys = {
    verifyBearerToken: vi.fn(),
  };
  const workspaceContext = {
    resolve: vi.fn().mockResolvedValue({
      workspace: { id: "w1" },
      request: {
        accountId: "u1",
        accountEmail: null,
        authMethod: "jwt",
        workspaceId: "w1",
        membershipId: "m1",
        role: "owner",
        permissions: new Set(["tunnel:create", "workspace:read"]),
      },
    }),
  };
  const permissions = {
    require: vi.fn(),
  };
  const tunnelManager = {
    unregisterClient: vi.fn().mockReturnValue(false),
    detachClient: vi.fn().mockReturnValue(false),
    lookup: vi.fn().mockReturnValue(undefined),
    create: vi.fn(),
  } as unknown as TunnelManager;

  // Long sweep cadence: these tests never advance timers, they only assert
  // that the gateway drives the monitor correctly.
  const heartbeats = new HeartbeatMonitor(60_000, 3_600_000);
  const security = new GatewaySecurityPolicy(resolveSecurityConfig(), new OriginValidator());
  const gateway = new TunnelGateway(
    auth as never,
    apiKeys as never,
    workspaceContext as never,
    permissions as never,
    tunnelManager,
    new HttpExchangeCoordinator(),
    heartbeats,
    security,
  );

  return { gateway, heartbeats, tunnelManager, security };
}

function createUpgradeRequest(ip = "127.0.0.1"): IncomingMessage {
  const socket = new Socket();
  Object.defineProperty(socket, "remoteAddress", { value: ip });
  return {
    headers: { authorization: "Bearer test-token" },
    socket,
  } as IncomingMessage;
}

function asClient(socket: FakeSocket): WebSocket {
  return socket as unknown as WebSocket;
}

describe("TunnelGateway heartbeat", () => {
  it("registers a client for liveness tracking on connect", async () => {
    const { gateway, heartbeats } = createGateway();
    const socket = new FakeSocket();

    await gateway.handleConnection(asClient(socket), createUpgradeRequest());

    expect(heartbeats.trackedClientCount()).toBe(1);

    heartbeats.onModuleDestroy();
  });

  it("replies to PING with a PONG echoing the requestId", async () => {
    const { gateway, heartbeats } = createGateway();
    const socket = new FakeSocket();

    await gateway.handleConnection(asClient(socket), createUpgradeRequest());
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({ type: MessageType.Ping, requestId: "hb-1" })),
    );

    const pong = socket.sentMessages().find((message) => message.type === MessageType.Pong);

    expect(pong).toEqual({ type: MessageType.Pong, requestId: "hb-1" });

    heartbeats.onModuleDestroy();
  });

  it("records a heartbeat when a PING arrives", async () => {
    const { gateway, heartbeats } = createGateway();
    const socket = new FakeSocket();
    const beat = vi.spyOn(heartbeats, "beat");

    await gateway.handleConnection(asClient(socket), createUpgradeRequest());
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({ type: MessageType.Ping, requestId: "hb-2" })),
    );

    expect(beat).toHaveBeenCalledWith(asClient(socket));

    heartbeats.onModuleDestroy();
  });

  it("stops tracking a client on disconnect", async () => {
    const { gateway, heartbeats, tunnelManager, security } = createGateway();
    const socket = new FakeSocket();

    await gateway.handleConnection(asClient(socket), createUpgradeRequest());
    expect(security.activeConnections()).toBe(1);

    gateway.handleDisconnect(asClient(socket));

    expect(heartbeats.trackedClientCount()).toBe(0);
    expect(security.activeConnections()).toBe(0);
    expect(tunnelManager.detachClient).toHaveBeenCalledWith(asClient(socket));
  });

  it("rejects HTTP response frames for tunnels the client does not own", async () => {
    const { gateway, heartbeats } = createGateway();
    const socket = new FakeSocket();

    await gateway.handleConnection(asClient(socket), createUpgradeRequest());
    socket.emit(
      "message",
      Buffer.from(
        JSON.stringify({
          type: MessageType.HttpResponseStart,
          requestId: "req-1",
          tunnelId: "not-owned",
          statusCode: 200,
          headers: {},
          setCookies: [],
          hasBody: false,
        }),
      ),
    );

    const error = socket.sentMessages().find((message) => message.type === MessageType.Error);
    expect(error?.code).toBe("unauthorized_tunnel");

    heartbeats.onModuleDestroy();
  });

  it("does not count HTTP response frames toward the WebSocket control-plane rate limit", async () => {
    process.env["BADGER_WS_MESSAGE_RATE_LIMIT"] = "2";

    try {
      const tunnelManager = {
        unregisterClient: vi.fn().mockReturnValue(false),
        detachClient: vi.fn().mockReturnValue(false),
        lookup: vi.fn(),
      } as unknown as TunnelManager;

      const heartbeats = new HeartbeatMonitor(60_000, 3_600_000);
      const exchanges = new HttpExchangeCoordinator();
      const deliver = vi.spyOn(exchanges, "deliver").mockReturnValue(true);
      const security = new GatewaySecurityPolicy(resolveSecurityConfig(), new OriginValidator());
      const auth = {
        verifyAccessToken: vi.fn().mockResolvedValue({ id: "u1", email: null }),
      };
      const apiKeys = {
        verifyBearerToken: vi.fn(),
      };
      const workspaceContext = {
        resolve: vi.fn().mockResolvedValue({
          workspace: { id: "w1" },
          request: {
            accountId: "u1",
            accountEmail: null,
            authMethod: "jwt",
            workspaceId: "w1",
            membershipId: "m1",
            role: "owner",
            permissions: new Set(["tunnel:create"]),
          },
        }),
      };
      const permissions = { require: vi.fn() };
      const gateway = new TunnelGateway(
        auth as never,
        apiKeys as never,
        workspaceContext as never,
        permissions as never,
        tunnelManager,
        exchanges,
        heartbeats,
        security,
      );
      const socket = new FakeSocket();
      const client = asClient(socket);

      vi.mocked(tunnelManager.lookup).mockReturnValue({
        id: "tun-1",
        client,
        port: 3000,
      });

      await gateway.handleConnection(client, createUpgradeRequest());

      for (let i = 0; i < 2; i += 1) {
        socket.emit(
          "message",
          Buffer.from(JSON.stringify({ type: MessageType.Ping, requestId: `burn-${String(i)}` })),
        );
      }

      socket.sent.length = 0;

      socket.emit(
        "message",
        Buffer.from(JSON.stringify({ type: MessageType.Ping, requestId: "over-budget" })),
      );
      expect(socket.sentMessages().some((message) => message.code === "rate_limited")).toBe(true);

      socket.sent.length = 0;

      for (let i = 0; i < 20; i += 1) {
        socket.emit(
          "message",
          Buffer.from(
            JSON.stringify({
              type: MessageType.HttpResponseChunk,
              requestId: "asset-1",
              tunnelId: "tun-1",
              sequence: i,
              encoding: "base64",
              data: Buffer.from(`chunk-${String(i)}`).toString("base64"),
            }),
          ),
        );
      }

      expect(deliver).toHaveBeenCalledTimes(20);
      expect(socket.sentMessages().some((message) => message.code === "rate_limited")).toBe(false);

      heartbeats.onModuleDestroy();
    } finally {
      delete process.env["BADGER_WS_MESSAGE_RATE_LIMIT"];
    }
  });
});
