import { describe, expect, it } from "vitest";

import {
  HttpMethod,
  MemoryStorage,
  StorageTrafficRecordStore,
  createTrafficBody,
  type TrafficRecord,
} from "@hridhin-k/badger-shared";

import { StatisticsService } from "./statistics.service.js";

/**
 * Builds a minimal traffic record for Nest adapter tests.
 *
 * @param overrides - Fields to replace.
 * @returns A complete {@link TrafficRecord}.
 */
function record(overrides: Partial<TrafficRecord> = {}): TrafficRecord {
  return {
    requestId: "req-1",
    timestamp: 50_000,
    method: HttpMethod.GET,
    path: "/api",
    headers: {},
    query: {},
    body: createTrafficBody(undefined),
    status: 200,
    responseHeaders: {},
    responseBody: createTrafficBody(undefined),
    latencyMs: 12,
    tunnelId: "tun-1",
    error: undefined,
    ...overrides,
  };
}

describe("StatisticsService (Nest adapter)", () => {
  it("aggregates recorded traffic through TRAFFIC_RECORD_STORE", async () => {
    const store = new StorageTrafficRecordStore(new MemoryStorage());
    await store.save(record({ requestId: "1", method: HttpMethod.GET, path: "/a" }));
    await store.save(
      record({
        requestId: "2",
        method: HttpMethod.POST,
        path: "/b",
        status: 404,
        latencyMs: 20,
        timestamp: 51_000,
      }),
    );

    const service = new StatisticsService(store);
    const stats = await service.getStatistics({ nowMs: 60_000 });

    expect(stats.totalRequests).toBe(2);
    expect(stats.errorRate).toBe(0.5);
    expect(stats.averageLatencyMs).toBe(16);
    expect(stats.methodCounts.map((entry) => entry.method)).toEqual(["GET", "POST"]);
  });
});
