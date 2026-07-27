import {
  BadgerEventType,
  HttpMethod,
  createEventBus,
  type EventBus,
} from "@hridhin-k/badger-shared";
import { afterEach, describe, expect, it } from "vitest";

import { MemoryTrafficRecordStore } from "./memory-traffic-record.store.js";
import { TrafficRecorderService } from "./traffic-recorder.service.js";

describe("TrafficRecorderService", () => {
  let eventBus: EventBus;
  let recorder: TrafficRecorderService;

  afterEach(() => {
    recorder.onModuleDestroy();
  });

  function createRecorder(): TrafficRecorderService {
    eventBus = createEventBus();
    recorder = new TrafficRecorderService(eventBus, new MemoryTrafficRecordStore());
    recorder.onModuleInit();
    return recorder;
  }

  it("records a full HTTP exchange from EventBus lifecycle events", () => {
    createRecorder();

    eventBus.publish(BadgerEventType.RequestReceived, {
      tunnelId: "tun-1",
      requestId: "req-1",
      method: HttpMethod.POST,
      path: "/echo",
      headers: { accept: "text/plain" },
      body: new Uint8Array([112, 105, 110, 103]),
      occurredAt: 1_000,
    });

    eventBus.publish(BadgerEventType.RequestForwarded, {
      tunnelId: "tun-1",
      requestId: "req-1",
      method: HttpMethod.POST,
      path: "/echo",
      occurredAt: 1_010,
    });

    eventBus.publish(BadgerEventType.ResponseReturned, {
      tunnelId: "tun-1",
      requestId: "req-1",
      method: HttpMethod.POST,
      path: "/echo",
      statusCode: 201,
      responseHeaders: { "x-test": "1" },
      responseBody: new Uint8Array([111, 107]),
      latencyMs: 25,
      occurredAt: 1_025,
    });

    const saved = recorder.findById("req-1");

    expect(saved).toEqual({
      requestId: "req-1",
      timestamp: 1_000,
      method: HttpMethod.POST,
      path: "/echo",
      headers: { accept: "text/plain" },
      body: new Uint8Array([112, 105, 110, 103]),
      status: 201,
      responseHeaders: { "x-test": "1" },
      responseBody: new Uint8Array([111, 107]),
      latencyMs: 25,
      tunnelId: "tun-1",
      error: undefined,
    });
  });

  it("records failures without changing prior request metadata", () => {
    createRecorder();

    eventBus.publish(BadgerEventType.RequestReceived, {
      tunnelId: "tun-1",
      requestId: "req-2",
      method: HttpMethod.GET,
      path: "/",
      headers: {},
      body: new Uint8Array(),
      occurredAt: 2_000,
    });

    eventBus.publish(BadgerEventType.RequestFailed, {
      tunnelId: "tun-1",
      requestId: "req-2",
      method: HttpMethod.GET,
      path: "/",
      error: "Tunnel WebSocket is not open.",
      occurredAt: 2_001,
    });

    expect(recorder.findById("req-2")).toEqual(
      expect.objectContaining({
        path: "/",
        status: undefined,
        error: "Tunnel WebSocket is not open.",
      }),
    );
  });

  it("ignores RequestFailed events that lack a request id", () => {
    createRecorder();

    eventBus.publish(BadgerEventType.RequestFailed, {
      tunnelId: "tun-1",
      requestId: undefined,
      method: HttpMethod.GET,
      path: "/",
      error: "unknown",
      occurredAt: 1,
    });

    expect(recorder.size()).toBe(0);
  });

  it("does not subscribe after destroy", () => {
    createRecorder();
    recorder.onModuleDestroy();

    eventBus.publish(BadgerEventType.RequestReceived, {
      tunnelId: "tun-1",
      requestId: "req-3",
      method: HttpMethod.GET,
      path: "/",
      headers: {},
      body: new Uint8Array(),
      occurredAt: 1,
    });

    expect(recorder.size()).toBe(0);
  });
});
