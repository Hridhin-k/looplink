import {
  BadgerEventType,
  HttpMethod,
  createEventBus,
  createEventPayload,
  createTrafficBody,
} from "@hridhin-k/badger-shared";
import { describe, expect, it, vi } from "vitest";

import type { StatisticsService } from "../statistics/statistics.service.js";
import { StatisticsNotifier } from "./statistics-notifier.js";

describe("StatisticsNotifier", () => {
  it("publishes StatisticsUpdated after workspace-scoped traffic events", async () => {
    const eventBus = createEventBus();
    const updated = vi.fn();
    eventBus.subscribe(BadgerEventType.StatisticsUpdated, updated);

    const statistics = {
      getStatistics: vi.fn().mockResolvedValue({
        totalRequests: 2,
        requestsPerMinute: 2,
        averageLatencyMs: 10,
        p95LatencyMs: 12,
        errorRate: 0,
        methodCounts: [],
        statusCodeCounts: [],
        topEndpoints: [],
        tunnels: [],
      }),
    } as unknown as StatisticsService;

    const notifier = new StatisticsNotifier(eventBus, statistics);
    notifier.onModuleInit();

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
        latencyMs: 1,
        correlationId: "req-1",
        workspaceId: "ws-1",
        occurredAt: 1,
        eventId: "e1",
      }),
    );

    await Promise.resolve();
    await Promise.resolve();
    await Promise.resolve();

    expect(statistics.getStatistics).toHaveBeenCalledWith({ workspaceId: "ws-1" });
    expect(updated).toHaveBeenCalled();
    expect(updated.mock.calls[0]?.[0]).toEqual(
      expect.objectContaining({
        workspaceId: "ws-1",
        statistics: expect.objectContaining({ totalRequests: 2 }),
      }),
    );

    notifier.onModuleDestroy();
  });

  it("skips anonymous traffic without a workspace id", async () => {
    const eventBus = createEventBus();
    const updated = vi.fn();
    eventBus.subscribe(BadgerEventType.StatisticsUpdated, updated);

    const statistics = {
      getStatistics: vi.fn(),
    } as unknown as StatisticsService;

    const notifier = new StatisticsNotifier(eventBus, statistics);
    notifier.onModuleInit();

    eventBus.publish(
      BadgerEventType.ResponseReturned,
      createEventPayload({
        tunnelId: "tun-anon",
        requestId: "req-anon",
        method: HttpMethod.GET,
        path: "/",
        statusCode: 200,
        responseHeaders: {},
        responseBody: createTrafficBody(undefined),
        latencyMs: 1,
        correlationId: "req-anon",
        occurredAt: 1,
        eventId: "e2",
      }),
    );

    await Promise.resolve();
    await Promise.resolve();

    expect(statistics.getStatistics).not.toHaveBeenCalled();
    expect(updated).not.toHaveBeenCalled();

    notifier.onModuleDestroy();
  });
});
