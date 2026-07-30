import { EventEmitter } from "node:events";

import {
  BadgerEventType,
  DashboardMessageType,
  HttpMethod,
  createEventBus,
  createEventPayload,
  createTrafficBody,
  EMPTY_TRAFFIC_BODY,
} from "@hridhin-k/badger-shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import WebSocket from "ws";

import { DashboardGateway } from "./dashboard.gateway.js";

class FakeSocket extends EventEmitter {
  readyState = WebSocket.OPEN;
  readonly sent: string[] = [];

  send(data: string): void {
    this.sent.push(data);
  }
}

function asClient(socket: FakeSocket): WebSocket {
  return socket as unknown as WebSocket;
}

function createGateway(eventBus = createEventBus()): DashboardGateway {
  const auth = { verifyAccessToken: vi.fn().mockResolvedValue({ id: "u1", email: null }) };
  const apiKeys = { verifyBearerToken: vi.fn() };
  const workspaceContext = {
    resolve: vi.fn().mockResolvedValue({
      request: { workspaceId: "w1", accountId: "u1" },
      workspace: { id: "w1" },
    }),
  };
  return new DashboardGateway(eventBus, auth as never, apiKeys as never, workspaceContext as never);
}

const authRequest = {
  headers: { authorization: "Bearer t" },
  url: "/dashboard/ws?workspaceId=w1",
} as never;

describe("DashboardGateway", () => {
  let gateway: DashboardGateway;

  afterEach(() => {
    gateway.onModuleDestroy();
  });

  it("acks connections and broadcasts EventBus tunnel/request/response/replay/stats", async () => {
    const eventBus = createEventBus();
    gateway = createGateway(eventBus);
    gateway.onModuleInit();

    const socket = new FakeSocket();
    await gateway.handleConnection(asClient(socket), authRequest);

    expect(gateway.connectedClientCount()).toBe(1);
    expect(JSON.parse(socket.sent[0] ?? "{}")).toEqual(
      expect.objectContaining({ type: DashboardMessageType.Connected }),
    );

    eventBus.publish(
      BadgerEventType.TunnelCreated,
      createEventPayload({
        tunnelId: "tun-1",
        publicUrl: "https://tun-1.example",
        port: 3000,
        restored: false,
        correlationId: "tun-1",
        occurredAt: 1,
        eventId: "e1",
      }),
    );

    eventBus.publish(
      BadgerEventType.RequestReceived,
      createEventPayload({
        tunnelId: "tun-1",
        requestId: "req-1",
        method: HttpMethod.GET,
        path: "/",
        headers: {},
        query: {},
        body: EMPTY_TRAFFIC_BODY,
        correlationId: "req-1",
        occurredAt: 2,
        eventId: "e2",
      }),
    );

    eventBus.publish(
      BadgerEventType.ResponseReturned,
      createEventPayload({
        tunnelId: "tun-1",
        requestId: "req-1",
        method: HttpMethod.GET,
        path: "/",
        statusCode: 200,
        responseHeaders: {},
        responseBody: createTrafficBody(undefined),
        latencyMs: 5,
        correlationId: "req-1",
        occurredAt: 3,
        eventId: "e3",
      }),
    );

    eventBus.publish(
      BadgerEventType.ReplayCompleted,
      createEventPayload({
        requestId: "req-1",
        tunnelId: "tun-1",
        method: HttpMethod.GET,
        path: "/",
        statusCode: 200,
        correlationId: "req-1",
        occurredAt: 4,
        eventId: "e4",
      }),
    );

    eventBus.publish(
      BadgerEventType.StatisticsUpdated,
      createEventPayload({
        statistics: {
          totalRequests: 1,
          requestsPerMinute: 1,
          averageLatencyMs: 5,
          p95LatencyMs: 5,
          errorRate: 0,
        },
        tunnelId: undefined,
        correlationId: undefined,
        occurredAt: 5,
        eventId: "e5",
      }),
    );

    eventBus.publish(
      BadgerEventType.TunnelClosed,
      createEventPayload({
        tunnelId: "tun-1",
        reason: "unregistered",
        correlationId: "tun-1",
        occurredAt: 6,
        eventId: "e6",
      }),
    );

    const types = socket.sent.slice(1).map((raw) => (JSON.parse(raw) as { type: string }).type);
    expect(types).toEqual([
      DashboardMessageType.TunnelConnected,
      DashboardMessageType.RequestReceived,
      DashboardMessageType.ResponseCompleted,
      DashboardMessageType.ReplayCompleted,
      DashboardMessageType.StatisticsUpdated,
      DashboardMessageType.TunnelDisconnected,
    ]);
  });

  it("stops broadcasting after disconnect and module destroy", async () => {
    const eventBus = createEventBus();
    gateway = createGateway(eventBus);
    gateway.onModuleInit();

    const socket = new FakeSocket();
    await gateway.handleConnection(asClient(socket), authRequest);
    gateway.handleDisconnect(asClient(socket));
    expect(gateway.connectedClientCount()).toBe(0);

    gateway.onModuleDestroy();
    const before = socket.sent.length;
    eventBus.publish(
      BadgerEventType.TunnelClosed,
      createEventPayload({
        tunnelId: "tun-1",
        reason: "expired",
        correlationId: "tun-1",
        occurredAt: 1,
        eventId: "e1",
      }),
    );
    expect(socket.sent.length).toBe(before);
  });

  it("does not throw when a client send fails", async () => {
    gateway = createGateway();
    gateway.onModuleInit();

    const socket = new FakeSocket();
    socket.send = vi.fn(() => {
      throw new Error("boom");
    }) as unknown as typeof socket.send;

    await gateway.handleConnection(asClient(socket), authRequest);
    expect(gateway.connectedClientCount()).toBe(0);
  });
});
