import { HttpMethod } from "../types/http-forwarding.js";
import { describe, expect, it } from "vitest";

import { BadgerEventType } from "./badger-events.js";
import { createEventBus } from "./create-event-bus.js";
import type { EventBus } from "./event-bus.js";

/**
 * Minimal publisher surface that mirrors how apps emit lifecycle events.
 *
 * Kept local to the integration test so it does not become a public API.
 */
class LifecyclePublisher {
  /**
   * @param eventBus - Shared bus injected by the composition root.
   */
  constructor(private readonly eventBus: EventBus) {}

  /**
   * Emits the tunnel + client happy path used by the server gateway.
   */
  openSession(): void {
    this.eventBus.publish(BadgerEventType.ClientConnected, {
      connectionId: "conn-1",
      occurredAt: 1,
    });
    this.eventBus.publish(BadgerEventType.TunnelCreated, {
      tunnelId: "tun-1",
      publicUrl: "https://tun-1.example",
      port: 3000,
      restored: false,
      occurredAt: 2,
    });
  }

  /**
   * Emits the HTTP forward path used by the request forwarder.
   */
  forwardRequest(): void {
    this.eventBus.publish(BadgerEventType.RequestReceived, {
      tunnelId: "tun-1",
      requestId: "req-1",
      method: HttpMethod.GET,
      path: "/health",
      occurredAt: 3,
    });
    this.eventBus.publish(BadgerEventType.RequestForwarded, {
      tunnelId: "tun-1",
      requestId: "req-1",
      method: HttpMethod.GET,
      path: "/health",
      occurredAt: 4,
    });
    this.eventBus.publish(BadgerEventType.ResponseReturned, {
      tunnelId: "tun-1",
      requestId: "req-1",
      method: HttpMethod.GET,
      path: "/health",
      statusCode: 200,
      occurredAt: 5,
    });
  }

  /**
   * Emits the CLI reconnect path.
   */
  reconnect(): void {
    this.eventBus.publish(BadgerEventType.ReconnectStarted, {
      tunnelId: "tun-1",
      publicUrl: "https://tun-1.example",
      port: 3000,
      occurredAt: 6,
    });
    this.eventBus.publish(BadgerEventType.ReconnectSucceeded, {
      tunnelId: "tun-1",
      publicUrl: "https://tun-1.example",
      port: 3000,
      restored: true,
      occurredAt: 7,
    });
  }
}

describe("EventBus integration", () => {
  it("lets independent publishers and subscribers share one injected bus", () => {
    const eventBus = createEventBus();
    const publisher = new LifecyclePublisher(eventBus);
    const timeline: string[] = [];

    eventBus.subscribe(BadgerEventType.ClientConnected, () => {
      timeline.push("ClientConnected");
    });
    eventBus.subscribe(BadgerEventType.TunnelCreated, () => {
      timeline.push("TunnelCreated");
    });
    eventBus.subscribe(BadgerEventType.RequestReceived, () => {
      timeline.push("RequestReceived");
    });
    eventBus.subscribe(BadgerEventType.RequestForwarded, () => {
      timeline.push("RequestForwarded");
    });
    eventBus.subscribe(BadgerEventType.ResponseReturned, () => {
      timeline.push("ResponseReturned");
    });
    eventBus.subscribe(BadgerEventType.ReconnectStarted, () => {
      timeline.push("ReconnectStarted");
    });
    eventBus.subscribe(BadgerEventType.ReconnectSucceeded, () => {
      timeline.push("ReconnectSucceeded");
    });

    publisher.openSession();
    publisher.forwardRequest();
    publisher.reconnect();

    expect(timeline).toEqual([
      "ClientConnected",
      "TunnelCreated",
      "RequestReceived",
      "RequestForwarded",
      "ResponseReturned",
      "ReconnectStarted",
      "ReconnectSucceeded",
    ]);
  });

  it("does not couple publishers when no subscribers are registered", () => {
    const eventBus = createEventBus();
    const publisher = new LifecyclePublisher(eventBus);

    expect(() => {
      publisher.openSession();
      publisher.forwardRequest();
      publisher.reconnect();
    }).not.toThrow();
  });
});
