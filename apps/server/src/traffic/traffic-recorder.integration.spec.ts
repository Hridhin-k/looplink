import { Buffer } from "node:buffer";

import { describe, expect, it } from "vitest";

import {
  BadgerEventType,
  HttpMethod,
  MemoryStorage,
  StorageTrafficRecordStore,
  TrafficRecorder,
  createEventBus,
  createEventPayload,
  createTrafficBody,
  trafficBodyToBytes,
} from "@hridhin-k/badger-shared";

/**
 * Integration: EventBus → TrafficRecorder → StorageProvider, with no
 * HttpForwardingService involvement (forward path stays frozen).
 */
describe("TrafficRecorder integration", () => {
  it("assembles a complete traffic record from lifecycle events", async () => {
    const eventBus = createEventBus();
    const store = new StorageTrafficRecordStore(new MemoryStorage());
    const recorder = new TrafficRecorder(eventBus, store);
    recorder.start();

    eventBus.publish(
      BadgerEventType.RequestReceived,
      createEventPayload({
        tunnelId: "tun-1",
        requestId: "req-live",
        method: HttpMethod.POST,
        path: "/echo",
        headers: { accept: "text/plain", "content-type": "text/plain" },
        query: { via: "test" },
        body: createTrafficBody("ping"),
        correlationId: "req-live",
        eventId: "e1",
        occurredAt: 1_000,
      }),
    );

    eventBus.publish(
      BadgerEventType.ResponseReturned,
      createEventPayload({
        tunnelId: "tun-1",
        requestId: "req-live",
        method: HttpMethod.POST,
        path: "/echo",
        statusCode: 200,
        responseHeaders: { "content-type": "text/plain" },
        responseBody: createTrafficBody("pong"),
        latencyMs: 12,
        correlationId: "req-live",
        eventId: "e2",
        occurredAt: 1_012,
      }),
    );

    await recorder.flush();

    const records = await recorder.list();
    expect(records).toHaveLength(1);

    const [saved] = records;
    expect(saved).toBeDefined();
    if (saved === undefined) {
      return;
    }

    expect(saved).toEqual(
      expect.objectContaining({
        requestId: "req-live",
        tunnelId: "tun-1",
        timestamp: 1_000,
        method: HttpMethod.POST,
        path: "/echo",
        headers: { accept: "text/plain", "content-type": "text/plain" },
        query: { via: "test" },
        status: 200,
        responseHeaders: { "content-type": "text/plain" },
        latencyMs: 12,
      }),
    );
    expect(Buffer.from(trafficBodyToBytes(saved.body)).toString("utf8")).toBe("ping");
    expect(Buffer.from(trafficBodyToBytes(saved.responseBody)).toString("utf8")).toBe("pong");

    recorder.stop();
  });
});
