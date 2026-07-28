import { afterEach, describe, expect, it } from "vitest";

import { BadgerEventType } from "../event-bus/badger-events.js";
import { createEventBus } from "../event-bus/create-event-bus.js";
import { createEventPayload } from "../event-bus/create-event-payload.js";
import type { EventBus } from "../event-bus/event-bus.js";
import { MemoryStorage } from "../storage/memory-storage.js";
import { HttpMethod } from "../types/http-forwarding.js";
import { StorageTrafficRecordStore } from "./storage-traffic-record-store.js";
import { createTrafficBody, trafficBodyToBytes } from "./traffic-body.js";
import { TrafficRecorder } from "./traffic-recorder.js";

describe("TrafficRecorder", () => {
  let eventBus: EventBus;
  let recorder: TrafficRecorder;

  afterEach(() => {
    recorder.stop();
  });

  function createRecorder(): TrafficRecorder {
    eventBus = createEventBus();
    recorder = new TrafficRecorder(eventBus, new StorageTrafficRecordStore(new MemoryStorage()));
    recorder.start();
    return recorder;
  }

  /**
   * Flushes async EventBus handlers for this recorder.
   */
  async function flush(): Promise<void> {
    await recorder.flush();
  }

  it("records a full HTTP exchange from EventBus lifecycle events", async () => {
    createRecorder();

    eventBus.publish(
      BadgerEventType.RequestReceived,
      createEventPayload({
        tunnelId: "tun-1",
        requestId: "req-1",
        method: HttpMethod.POST,
        path: "/echo",
        headers: { accept: "text/plain" },
        query: { n: "1" },
        body: createTrafficBody("ping"),
        correlationId: "req-1",
        eventId: "e1",
        occurredAt: 1_000,
      }),
    );

    eventBus.publish(
      BadgerEventType.RequestForwarded,
      createEventPayload({
        tunnelId: "tun-1",
        requestId: "req-1",
        method: HttpMethod.POST,
        path: "/echo",
        correlationId: "req-1",
        eventId: "e2",
        occurredAt: 1_010,
      }),
    );

    eventBus.publish(
      BadgerEventType.ResponseReturned,
      createEventPayload({
        tunnelId: "tun-1",
        requestId: "req-1",
        method: HttpMethod.POST,
        path: "/echo",
        statusCode: 201,
        responseHeaders: { "x-test": "1" },
        responseBody: createTrafficBody("ok"),
        latencyMs: 25,
        correlationId: "req-1",
        eventId: "e3",
        occurredAt: 1_025,
      }),
    );

    await flush();

    const saved = await recorder.findById("req-1");

    expect(saved).toEqual({
      requestId: "req-1",
      timestamp: 1_000,
      method: HttpMethod.POST,
      path: "/echo",
      headers: { accept: "text/plain" },
      query: { n: "1" },
      body: createTrafficBody("ping"),
      status: 201,
      responseHeaders: { "x-test": "1" },
      responseBody: createTrafficBody("ok"),
      latencyMs: 25,
      tunnelId: "tun-1",
      error: undefined,
    });
    expect(trafficBodyToBytes(saved?.body ?? createTrafficBody(undefined))).toEqual(
      new Uint8Array([112, 105, 110, 103]),
    );
  });

  it("records failures without changing prior request metadata", async () => {
    createRecorder();

    eventBus.publish(
      BadgerEventType.RequestReceived,
      createEventPayload({
        tunnelId: "tun-1",
        requestId: "req-2",
        method: HttpMethod.GET,
        path: "/",
        headers: {},
        query: {},
        body: createTrafficBody(undefined),
        correlationId: "req-2",
        eventId: "e1",
        occurredAt: 2_000,
      }),
    );

    eventBus.publish(
      BadgerEventType.RequestFailed,
      createEventPayload({
        tunnelId: "tun-1",
        requestId: "req-2",
        method: HttpMethod.GET,
        path: "/",
        error: "Tunnel WebSocket is not open.",
        correlationId: "req-2",
        eventId: "e2",
        occurredAt: 2_001,
      }),
    );

    await flush();

    await expect(recorder.findById("req-2")).resolves.toEqual(
      expect.objectContaining({
        path: "/",
        status: undefined,
        error: "Tunnel WebSocket is not open.",
      }),
    );
  });

  it("ignores RequestFailed events that lack a request id", async () => {
    createRecorder();

    eventBus.publish(
      BadgerEventType.RequestFailed,
      createEventPayload({
        tunnelId: "tun-1",
        requestId: undefined,
        method: HttpMethod.GET,
        path: "/",
        error: "unknown",
        correlationId: undefined,
        eventId: "e1",
        occurredAt: 1,
      }),
    );

    await flush();

    await expect(recorder.size()).resolves.toBe(0);
  });

  it("does not subscribe after stop", async () => {
    createRecorder();
    recorder.stop();

    eventBus.publish(
      BadgerEventType.RequestReceived,
      createEventPayload({
        tunnelId: "tun-1",
        requestId: "req-3",
        method: HttpMethod.GET,
        path: "/",
        headers: {},
        query: {},
        body: createTrafficBody(undefined),
        correlationId: "req-3",
        eventId: "e1",
        occurredAt: 1,
      }),
    );

    await flush();

    await expect(recorder.size()).resolves.toBe(0);
  });
});
