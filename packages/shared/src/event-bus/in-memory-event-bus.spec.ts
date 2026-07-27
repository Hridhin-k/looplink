import { describe, expect, it, vi } from "vitest";

import { HttpMethod } from "../types/http-forwarding.js";
import { BadgerEventType } from "./badger-events.js";
import { createEventBus } from "./create-event-bus.js";
import { InMemoryEventBus } from "./in-memory-event-bus.js";

describe("InMemoryEventBus", () => {
  it("delivers a typed payload only to matching subscribers", () => {
    const bus = new InMemoryEventBus();
    const created = vi.fn();
    const closed = vi.fn();

    bus.subscribe(BadgerEventType.TunnelCreated, created);
    bus.subscribe(BadgerEventType.TunnelClosed, closed);

    const payload = {
      tunnelId: "tun-1",
      publicUrl: "https://tun-1.example",
      port: 3000,
      restored: false,
      occurredAt: 1,
    };

    bus.publish(BadgerEventType.TunnelCreated, payload);

    expect(created).toHaveBeenCalledExactlyOnceWith(payload);
    expect(closed).not.toHaveBeenCalled();
  });

  it("stops delivering after unsubscribe", () => {
    const bus = createEventBus();
    const handler = vi.fn();
    const subscription = bus.subscribe(BadgerEventType.ClientConnected, handler);

    bus.publish(BadgerEventType.ClientConnected, {
      connectionId: "c-1",
      occurredAt: 1,
    });
    subscription.unsubscribe();
    bus.publish(BadgerEventType.ClientConnected, {
      connectionId: "c-2",
      occurredAt: 2,
    });

    expect(handler).toHaveBeenCalledTimes(1);
  });

  it("isolates synchronous subscriber failures from publishers", () => {
    const bus = createEventBus();
    const healthy = vi.fn();

    bus.subscribe(BadgerEventType.RequestFailed, () => {
      throw new Error("subscriber boom");
    });
    bus.subscribe(BadgerEventType.RequestFailed, healthy);

    expect(() => {
      bus.publish(BadgerEventType.RequestFailed, {
        tunnelId: "tun-1",
        requestId: "req-1",
        method: HttpMethod.GET,
        path: "/",
        error: "timeout",
        occurredAt: 1,
      });
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

    bus.publish(BadgerEventType.ResponseReturned, {
      tunnelId: "tun-1",
      requestId: "req-1",
      method: HttpMethod.GET,
      path: "/",
      statusCode: 200,
      occurredAt: 1,
    });

    await Promise.resolve();

    expect(healthy).toHaveBeenCalledTimes(1);
  });

  it("allows a handler to unsubscribe itself during publish", () => {
    const bus = createEventBus();
    const calls: string[] = [];
    let subscription = {
      unsubscribe: (): void => {
        // replaced below
      },
    };

    subscription = bus.subscribe(BadgerEventType.ReconnectStarted, () => {
      calls.push("first");
      subscription.unsubscribe();
    });
    bus.subscribe(BadgerEventType.ReconnectStarted, () => {
      calls.push("second");
    });

    bus.publish(BadgerEventType.ReconnectStarted, {
      tunnelId: "tun-1",
      publicUrl: "https://tun-1.example",
      port: 3000,
      occurredAt: 1,
    });
    bus.publish(BadgerEventType.ReconnectStarted, {
      tunnelId: "tun-1",
      publicUrl: "https://tun-1.example",
      port: 3000,
      occurredAt: 2,
    });

    expect(calls).toEqual(["first", "second", "second"]);
  });

  it("clear removes every subscription", () => {
    const bus = createEventBus();
    const handler = vi.fn();

    bus.subscribe(BadgerEventType.TunnelClosed, handler);
    bus.clear();
    bus.publish(BadgerEventType.TunnelClosed, {
      tunnelId: "tun-1",
      reason: "expired",
      occurredAt: 1,
    });

    expect(handler).not.toHaveBeenCalled();
  });
});
