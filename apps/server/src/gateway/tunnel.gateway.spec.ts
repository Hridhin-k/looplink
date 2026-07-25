import { EventEmitter } from "node:events";

import { MessageType } from "@looplink/shared";
import { describe, expect, it, vi } from "vitest";
import WebSocket from "ws";

import { HeartbeatMonitor } from "./heartbeat.monitor.js";
import { TunnelGateway } from "./tunnel.gateway.js";
import { HttpExchangeCoordinator } from "../http-forward/http-exchange.coordinator.js";
import type { TunnelManager } from "../tunnel/tunnel.manager.js";

class FakeSocket extends EventEmitter {
  readyState = WebSocket.OPEN;
  readonly sent: string[] = [];
  readonly terminate = vi.fn();

  send(data: string): void {
    this.sent.push(data);
  }

  /** Parsed protocol payloads written to this socket, in send order. */
  sentMessages(): { type: string; requestId?: string }[] {
    return this.sent.map((raw) => JSON.parse(raw) as { type: string; requestId?: string });
  }
}

function createGateway(): {
  gateway: TunnelGateway;
  heartbeats: HeartbeatMonitor;
  tunnelManager: TunnelManager;
} {
  const tunnelManager = {
    unregisterClient: vi.fn().mockReturnValue(false),
    detachClient: vi.fn().mockReturnValue(false),
  } as unknown as TunnelManager;

  // Long sweep cadence: these tests never advance timers, they only assert
  // that the gateway drives the monitor correctly.
  const heartbeats = new HeartbeatMonitor(60_000, 3_600_000);
  const gateway = new TunnelGateway(tunnelManager, new HttpExchangeCoordinator(), heartbeats);

  return { gateway, heartbeats, tunnelManager };
}

function asClient(socket: FakeSocket): WebSocket {
  return socket as unknown as WebSocket;
}

describe("TunnelGateway heartbeat", () => {
  it("registers a client for liveness tracking on connect", () => {
    const { gateway, heartbeats } = createGateway();
    const socket = new FakeSocket();

    gateway.handleConnection(asClient(socket));

    expect(heartbeats.trackedClientCount()).toBe(1);

    heartbeats.onModuleDestroy();
  });

  it("replies to PING with a PONG echoing the requestId", () => {
    const { gateway, heartbeats } = createGateway();
    const socket = new FakeSocket();

    gateway.handleConnection(asClient(socket));
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

    gateway.handleConnection(asClient(socket));
    socket.emit(
      "message",
      Buffer.from(JSON.stringify({ type: MessageType.Ping, requestId: "hb-2" })),
    );

    expect(beat).toHaveBeenCalledWith(asClient(socket));

    heartbeats.onModuleDestroy();
  });

  it("stops tracking a client on disconnect", () => {
    const { gateway, heartbeats, tunnelManager } = createGateway();
    const socket = new FakeSocket();

    gateway.handleConnection(asClient(socket));
    gateway.handleDisconnect(asClient(socket));

    expect(heartbeats.trackedClientCount()).toBe(0);
    expect(tunnelManager.detachClient).toHaveBeenCalledWith(asClient(socket));
  });
});
