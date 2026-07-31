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

import { ContextFactory } from "../context/context.factory.js";
import { ContextResolver } from "../context/context.resolver.js";
import { ContextSessionStore } from "../context/providers/context-session.store.js";
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

function createGateway(eventBus = createEventBus()): {
  gateway: DashboardGateway;
  contextSessions: ContextSessionStore;
} {
  const resolver = new ContextResolver(
    new ContextFactory(),
    { verifyAccessToken: vi.fn().mockResolvedValue({ id: "u1", email: null }) } as never,
    { verifyBearerToken: vi.fn() } as never,
    {
      resolve: vi.fn().mockResolvedValue({
        request: {
          workspaceId: "w1",
          accountId: "u1",
          accountEmail: null,
          authMethod: "jwt",
          membershipId: "m1",
          role: "owner",
          permissions: new Set(["inspector:read"]),
        },
        workspace: { id: "w1" },
      }),
    } as never,
    { validate: vi.fn() } as never,
  );
  const contextSessions = new ContextSessionStore();
  return {
    gateway: new DashboardGateway(eventBus, resolver, contextSessions),
    contextSessions,
  };
}

const authRequest = {
  headers: { authorization: "Bearer t" },
  url: "/dashboard/ws?workspaceId=w1",
} as never;

describe("DashboardGateway", () => {
  let gateway: DashboardGateway;
  let contextSessions: ContextSessionStore;

  afterEach(() => {
    gateway.onModuleDestroy();
  });

  it("acks connections and broadcasts workspace-scoped EventBus events only", async () => {
    const eventBus = createEventBus();
    ({ gateway, contextSessions } = createGateway(eventBus));
    gateway.onModuleInit();

    const socket = new FakeSocket();
    await gateway.handleConnection(asClient(socket), authRequest);

    expect(gateway.connectedClientCount()).toBe(1);
    expect(contextSessions.size()).toBe(1);
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
        workspaceId: "w1",
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
        workspaceId: "w1",
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
        workspaceId: "w1",
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
        workspaceId: "w1",
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
        tunnelId: "tun-1",
        workspaceId: "w1",
        occurredAt: 5,
        eventId: "e5",
      }),
    );

    eventBus.publish(
      BadgerEventType.TunnelClosed,
      createEventPayload({
        tunnelId: "tun-1",
        reason: "unregistered",
        workspaceId: "w1",
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

  it("does not deliver unscoped or other-workspace events", async () => {
    const eventBus = createEventBus();
    ({ gateway } = createGateway(eventBus));
    gateway.onModuleInit();

    const socket = new FakeSocket();
    await gateway.handleConnection(asClient(socket), authRequest);
    const afterConnect = socket.sent.length;

    eventBus.publish(
      BadgerEventType.RequestReceived,
      createEventPayload({
        tunnelId: "tun-anon",
        requestId: "req-anon",
        method: HttpMethod.GET,
        path: "/",
        headers: {},
        query: {},
        body: EMPTY_TRAFFIC_BODY,
        correlationId: "req-anon",
        occurredAt: 2,
        eventId: "e-anon",
      }),
    );

    eventBus.publish(
      BadgerEventType.RequestReceived,
      createEventPayload({
        tunnelId: "tun-2",
        requestId: "req-2",
        method: HttpMethod.GET,
        path: "/",
        headers: {},
        query: {},
        body: EMPTY_TRAFFIC_BODY,
        workspaceId: "w2",
        correlationId: "req-2",
        occurredAt: 3,
        eventId: "e-other",
      }),
    );

    expect(socket.sent.length).toBe(afterConnect);
  });

  it("stops broadcasting after disconnect and destroys context binding", async () => {
    const eventBus = createEventBus();
    ({ gateway, contextSessions } = createGateway(eventBus));
    gateway.onModuleInit();

    const socket = new FakeSocket();
    await gateway.handleConnection(asClient(socket), authRequest);
    gateway.handleDisconnect(asClient(socket));
    expect(gateway.connectedClientCount()).toBe(0);
    expect(contextSessions.size()).toBe(0);

    gateway.onModuleDestroy();
    const before = socket.sent.length;
    eventBus.publish(
      BadgerEventType.TunnelClosed,
      createEventPayload({
        tunnelId: "tun-1",
        reason: "unregistered",
        workspaceId: "w1",
        correlationId: "tun-1",
        occurredAt: 6,
        eventId: "e6",
      }),
    );
    expect(socket.sent.length).toBe(before);
  });
});
