import { EventEmitter } from "node:events";
import type { IncomingMessage } from "node:http";
import { Socket } from "node:net";

import { MessageType } from "@looplink/shared";
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

function createUpgradeRequest(ip = "127.0.0.1"): IncomingMessage {
  const socket = new Socket();
  Object.defineProperty(socket, "remoteAddress", { value: ip });
  return { headers: {}, socket } as IncomingMessage;
}

function createGateway(): {
  gateway: TunnelGateway;
  heartbeats: HeartbeatMonitor;
  tunnelManager: TunnelManager;
  security: GatewaySecurityPolicy;
} {
  const tunnelManager = {
    unregisterClient: vi.fn().mockReturnValue(false),
    detachClient: vi.fn().mockReturnValue(false),
    lookup: vi.fn().mockReturnValue(undefined),
  } as unknown as TunnelManager;

  // Long sweep cadence: these tests never advance timers, they only assert
  // that the gateway drives the monitor correctly.
  const heartbeats = new HeartbeatMonitor(60_000, 3_600_000);
  const security = new GatewaySecurityPolicy(resolveSecurityConfig(), new OriginValidator());
  const gateway = new TunnelGateway(
    tunnelManager,
    new HttpExchangeCoordinator(),
    heartbeats,
    security,
  );

  return { gateway, heartbeats, tunnelManager, security };
}

function asClient(socket: FakeSocket): WebSocket {
  return socket as unknown as WebSocket;
}

describe("TunnelGateway heartbeat", () => {
  it("registers a client for liveness tracking on connect", () => {
    const { gateway, heartbeats } = createGateway();
    const socket = new FakeSocket();

    gateway.handleConnection(asClient(socket), createUpgradeRequest());

    expect(heartbeats.trackedClientCount()).toBe(1);

    heartbeats.onModuleDestroy();
  });

  it("replies to PING with a PONG echoing the requestId", () => {
    const { gateway, heartbeats } = createGateway();
    const socket = new FakeSocket();

    gateway.handleConnection(asClient(socket), createUpgradeRequest());
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({ type: MessageType.Ping, requestId: "hb-1" })),
    );

    const pong = socket.sentMessages().find((message) => message.type === MessageType.Pong);

    expect(pong).toEqual({ type: MessageType.Pong, requestId: "hb-1" });

    heartbeats.onModuleDestroy();
  });

  it("records a heartbeat when a PING arrives", () => {
    const { gateway, heartbeats } = createGateway();
    const socket = new FakeSocket();
    const beat = vi.spyOn(heartbeats, "beat");

    gateway.handleConnection(asClient(socket), createUpgradeRequest());
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({ type: MessageType.Ping, requestId: "hb-2" })),
    );

    expect(beat).toHaveBeenCalledWith(asClient(socket));

    heartbeats.onModuleDestroy();
  });

  it("stops tracking a client on disconnect", () => {
    const { gateway, heartbeats, tunnelManager, security } = createGateway();
    const socket = new FakeSocket();

    gateway.handleConnection(asClient(socket), createUpgradeRequest());
    expect(security.activeConnections()).toBe(1);

    gateway.handleDisconnect(asClient(socket));

    expect(heartbeats.trackedClientCount()).toBe(0);
    expect(security.activeConnections()).toBe(0);
    expect(tunnelManager.detachClient).toHaveBeenCalledWith(asClient(socket));
  });

  it("rejects HTTP response frames for tunnels the client does not own", () => {
    const { gateway, heartbeats } = createGateway();
    const socket = new FakeSocket();

    gateway.handleConnection(asClient(socket), createUpgradeRequest());
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
});
