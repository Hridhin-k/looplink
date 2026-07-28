import { describe, expect, it, vi } from "vitest";

import { EMPTY_TRAFFIC_BODY } from "../traffic/traffic-body.js";
import { HttpMethod } from "../types/http-forwarding.js";
import { BadgerEventType } from "./badger-events.js";
import { createEventBus } from "./create-event-bus.js";
import { createEventPayload } from "./create-event-payload.js";
import { InMemoryEventBus } from "./in-memory-event-bus.js";

describe("createEventPayload", () => {
  it("stamps eventId, occurredAt, and correlationId immutably", () => {
    const payload = createEventPayload({
      tunnelId: "tun-1",
      publicUrl: "https://tun-1.example",
      port: 3000,
      restored: false,
      correlationId: "corr-1",
      eventId: "evt-1",
      occurredAt: 42,
    });

    expect(payload).toEqual({
      tunnelId: "tun-1",
      publicUrl: "https://tun-1.example",
      port: 3000,
      restored: false,
      correlationId: "corr-1",
      eventId: "evt-1",
      occurredAt: 42,
    });
    expect(Object.isFrozen(payload)).toBe(true);
  });

  it("generates eventId and occurredAt when omitted", () => {
    const before = Date.now();
    const payload = createEventPayload({ tunnelId: "tun-1", reason: "expired" as const });
    const after = Date.now();

    expect(payload.eventId.length).toBeGreaterThan(0);
    expect(payload.occurredAt).toBeGreaterThanOrEqual(before);
    expect(payload.occurredAt).toBeLessThanOrEqual(after);
    expect(payload.correlationId).toBeUndefined();
  });
});

describe("InMemoryEventBus", () => {
  it("delivers a typed payload only to matching subscribers", () => {
    const bus = new InMemoryEventBus();
    const created = vi.fn();
    const closed = vi.fn();

    bus.subscribe(BadgerEventType.TunnelCreated, created);
    bus.subscribe(BadgerEventType.TunnelClosed, closed);

    const payload = createEventPayload({
      tunnelId: "tun-1",
      publicUrl: "https://tun-1.example",
      port: 3000,
      restored: false,
      correlationId: "tun-1",
      eventId: "evt-1",
      occurredAt: 1,
    });

    bus.publish(BadgerEventType.TunnelCreated, payload);

    expect(created).toHaveBeenCalledExactlyOnceWith(payload);
    expect(closed).not.toHaveBeenCalled();
  });

  it("stops delivering after subscription.unsubscribe", () => {
    const bus = createEventBus();
    const handler = vi.fn();
    const subscription = bus.subscribe(BadgerEventType.ClientConnected, handler);

    bus.publish(
      BadgerEventType.ClientConnected,
      createEventPayload({
        connectionId: "c-1",
        correlationId: "c-1",
        eventId: "e1",
        occurredAt: 1,
      }),
    );
    subscription.unsubscribe();
    bus.publish(
      BadgerEventType.ClientConnected,
      createEventPayload({
        connectionId: "c-2",
        correlationId: "c-2",
        eventId: "e2",
        occurredAt: 2,
      }),
    );

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("stops delivering after bus.unsubscribe with the same handler reference", () => {
    const bus = createEventBus();
    const handler = vi.fn();

    bus.subscribe(BadgerEventType.TunnelClosed, handler);
    bus.unsubscribe(BadgerEventType.TunnelClosed, handler);
    bus.publish(
      BadgerEventType.TunnelClosed,
      createEventPayload({
        tunnelId: "tun-1",
        reason: "expired",
        correlationId: "tun-1",
        eventId: "e1",
        occurredAt: 1,
      }),
    );

    expect(handler).not.toHaveBeenCalled();
  });

  it("once delivers a single time then auto-unsubscribes", () => {
    const bus = createEventBus();
    const handler = vi.fn();

    bus.once(BadgerEventType.ResponseReturned, handler);

    const first = createEventPayload({
      tunnelId: "tun-1",
      requestId: "req-1",
      method: HttpMethod.GET,
      path: "/",
      statusCode: 200,
      responseHeaders: {},
      responseBody: EMPTY_TRAFFIC_BODY,
      latencyMs: 1,
      correlationId: "req-1",
      eventId: "e1",
      occurredAt: 1,
    });
    const second = createEventPayload({
      tunnelId: "tun-1",
      requestId: "req-2",
      method: HttpMethod.GET,
      path: "/",
      statusCode: 200,
      responseHeaders: {},
      responseBody: EMPTY_TRAFFIC_BODY,
      latencyMs: 1,
      correlationId: "req-2",
      eventId: "e2",
      occurredAt: 2,
    });

    bus.publish(BadgerEventType.ResponseReturned, first);
    bus.publish(BadgerEventType.ResponseReturned, second);

    expect(handler).toHaveBeenCalledExactlyOnceWith(first);
  });

  it("once can be cancelled via unsubscribe before delivery", () => {
    const bus = createEventBus();
    const handler = vi.fn();

    bus.once(BadgerEventType.RequestReceived, handler);
    bus.unsubscribe(BadgerEventType.RequestReceived, handler);
    bus.publish(
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
        eventId: "e1",
        occurredAt: 1,
      }),
    );

    expect(handler).not.toHaveBeenCalled();
  });

  it("isolates synchronous subscriber failures from publishers", () => {
    const bus = createEventBus();
    const healthy = vi.fn();

    bus.subscribe(BadgerEventType.RequestFailed, () => {
      throw new Error("subscriber boom");
    });
    bus.subscribe(BadgerEventType.RequestFailed, healthy);

    expect(() => {
      bus.publish(
        BadgerEventType.RequestFailed,
        createEventPayload({
          tunnelId: "tun-1",
          requestId: "req-1",
          method: HttpMethod.GET,
          path: "/",
          error: "timeout",
          correlationId: "req-1",
          eventId: "e1",
          occurredAt: 1,
        }),
      );
    }).not.toThrow();

    expect(healthy).toHaveBeenCalledTimes(1);
  });

  it("isolates asynchronous subscriber rejections", async () => {
    const bus = createEventBus();
    const healthy = vi.fn();

    bus.subscribe(BadgerEventType.ResponseReturned, async () => {
      await Promise.reject(new Error("async boom"));
    });
    bus.subscribe(BadgerEventType.ResponseReturned, healthy);

    bus.publish(
      BadgerEventType.ResponseReturned,
      createEventPayload({
        tunnelId: "tun-1",
        requestId: "req-1",
        method: HttpMethod.GET,
        path: "/",
        statusCode: 200,
        responseHeaders: {},
        responseBody: EMPTY_TRAFFIC_BODY,
        latencyMs: 1,
        correlationId: "req-1",
        eventId: "e1",
        occurredAt: 1,
      }),
    );

    await Promise.resolve();

    expect(healthy).toHaveBeenCalledTimes(1);
  });

  it("allows a handler to unsubscribe itself during publish", () => {
    const bus = createEventBus();
    const calls: string[] = [];

    const first = (): void => {
      calls.push("first");
      bus.unsubscribe(BadgerEventType.ReconnectStarted, first);
    };

    bus.subscribe(BadgerEventType.ReconnectStarted, first);
    bus.subscribe(BadgerEventType.ReconnectStarted, () => {
      calls.push("second");
    });

    const payload = createEventPayload({
      tunnelId: "tun-1",
      publicUrl: "https://tun-1.example",
      port: 3000,
      correlationId: "tun-1",
      eventId: "e1",
      occurredAt: 1,
    });

    bus.publish(BadgerEventType.ReconnectStarted, payload);
    bus.publish(BadgerEventType.ReconnectStarted, {
      ...payload,
      eventId: "e2",
      occurredAt: 2,
    });

    expect(calls).toEqual(["first", "second", "second"]);
  });

  it("clear removes every subscription", () => {
    const bus = createEventBus();
    const handler = vi.fn();

    bus.subscribe(BadgerEventType.TunnelClosed, handler);
    bus.clear();
    bus.publish(
      BadgerEventType.TunnelClosed,
      createEventPayload({
        tunnelId: "tun-1",
        reason: "expired",
        correlationId: "tun-1",
        eventId: "e1",
        occurredAt: 1,
      }),
    );

    expect(handler).not.toHaveBeenCalled();
  });
});
