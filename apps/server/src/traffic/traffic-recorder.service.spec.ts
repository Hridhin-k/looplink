import { afterEach, describe, expect, it } from "vitest";

import {
  BadgerEventType,
  EMPTY_TRAFFIC_BODY,
  HttpMethod,
  MemoryStorage,
  StorageTrafficRecordStore,
  createEventBus,
  createEventPayload,
  createTrafficBody,
  type EventBus,
} from "@hridhin-k/badger-shared";

import { TrafficRecorderService } from "./traffic-recorder.service.js";

describe("TrafficRecorderService", () => {
  let eventBus: EventBus;
  let service: TrafficRecorderService;

  afterEach(() => {
    service.onModuleDestroy();
  });

  function createService(): TrafficRecorderService {
    eventBus = createEventBus();
    service = new TrafficRecorderService(
      eventBus,
      new StorageTrafficRecordStore(new MemoryStorage()),
    );
    service.onModuleInit();
    return service;
  }

  async function flush(): Promise<void> {
    await service.flush();
  }

  it("persists exchanges published on the shared EventBus", async () => {
    createService();

    eventBus.publish(
      BadgerEventType.RequestReceived,
      createEventPayload({
        tunnelId: "tun-1",
        requestId: "req-1",
        method: HttpMethod.GET,
        path: "/api",
        headers: { accept: "application/json" },
        query: { page: "1" },
        body: EMPTY_TRAFFIC_BODY,
        correlationId: "req-1",
        eventId: "e1",
        occurredAt: 10,
      }),
    );

    eventBus.publish(
      BadgerEventType.ResponseReturned,
      createEventPayload({
        tunnelId: "tun-1",
        requestId: "req-1",
        method: HttpMethod.GET,
        path: "/api",
        statusCode: 200,
        responseHeaders: { "content-type": "application/json" },
        responseBody: createTrafficBody("{}"),
        latencyMs: 5,
        correlationId: "req-1",
        eventId: "e2",
        occurredAt: 15,
      }),
    );

    await flush();

    const saved = await service.findById("req-1");
    expect(saved).toEqual(
      expect.objectContaining({
        requestId: "req-1",
        tunnelId: "tun-1",
        method: HttpMethod.GET,
        path: "/api",
        query: { page: "1" },
        status: 200,
        latencyMs: 5,
      }),
    );
  });
});
