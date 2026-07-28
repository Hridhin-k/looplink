import { describe, expect, it } from "vitest";

import { MemoryStorage } from "../storage/memory-storage.js";
import { HttpMethod } from "../types/http-forwarding.js";
import { StorageTrafficRecordStore } from "../traffic/storage-traffic-record-store.js";
import { createTrafficBody } from "../traffic/traffic-body.js";
import type { TrafficRecord } from "../traffic/traffic-record.js";
import { StatisticsService } from "./statistics-service.js";

/**
 * Builds a minimal traffic record for service tests.
 *
 * @param overrides - Fields to replace.
 * @returns A complete {@link TrafficRecord}.
 */
function record(overrides: Partial<TrafficRecord> = {}): TrafficRecord {
  return {
    requestId: "req-1",
    timestamp: 1_000,
    method: HttpMethod.GET,
    path: "/",
    headers: {},
    query: {},
    body: createTrafficBody("ignored"),
    status: 200,
    responseHeaders: {},
    responseBody: createTrafficBody(undefined),
    latencyMs: 10,
    tunnelId: "tun-1",
    error: undefined,
    ...overrides,
  };
}

describe("StatisticsService", () => {
  it("loads records from TrafficRecordStore without bodies", async () => {
    const store = new StorageTrafficRecordStore(new MemoryStorage());
    await store.save(
      record({
        requestId: "1",
        timestamp: 50_000,
        method: HttpMethod.GET,
        path: "/health",
        latencyMs: 5,
        status: 200,
      }),
    );
    await store.save(
      record({
        requestId: "2",
        timestamp: 51_000,
        method: HttpMethod.POST,
        path: "/echo",
        latencyMs: 15,
        status: 500,
        tunnelId: "tun-2",
      }),
    );

    const service = new StatisticsService(store);
    const stats = await service.getStatistics({ nowMs: 60_000 });

    expect(stats.totalRequests).toBe(2);
    expect(stats.requestsPerMinute).toBe(2);
    expect(stats.averageLatencyMs).toBe(10);
    expect(stats.p95LatencyMs).toBe(15);
    expect(stats.errorRate).toBe(0.5);
    expect(stats.methodCounts).toEqual([
      { method: "GET", count: 1 },
      { method: "POST", count: 1 },
    ]);
    expect(stats.statusCodeCounts).toEqual([
      { statusCode: 200, count: 1 },
      { statusCode: 500, count: 1 },
    ]);
    expect(stats.topEndpoints).toEqual([
      { method: "GET", path: "/health", count: 1 },
      { method: "POST", path: "/echo", count: 1 },
    ]);
    expect(stats.tunnels).toHaveLength(2);
  });

  it("scopes to a single tunnel and omits tunnel breakdown", async () => {
    const store = new StorageTrafficRecordStore(new MemoryStorage());
    await store.save(record({ requestId: "1", tunnelId: "tun-a", timestamp: 50_000 }));
    await store.save(record({ requestId: "2", tunnelId: "tun-b", timestamp: 51_000 }));

    const service = new StatisticsService(store);
    const stats = await service.getStatistics({ tunnelId: "tun-a", nowMs: 60_000 });

    expect(stats.totalRequests).toBe(1);
    expect(stats.tunnels).toEqual([]);
  });
});
