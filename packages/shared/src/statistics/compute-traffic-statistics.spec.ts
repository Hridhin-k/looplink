import { describe, expect, it } from "vitest";

import { HttpMethod } from "../types/http-forwarding.js";
import { createTrafficBody } from "../traffic/traffic-body.js";
import type { TrafficRecord } from "../traffic/traffic-record.js";
import { computeTrafficStatistics } from "./compute-traffic-statistics.js";

/**
 * Builds a minimal traffic record for statistics tests.
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
    body: createTrafficBody(undefined),
    status: 200,
    responseHeaders: {},
    responseBody: createTrafficBody(undefined),
    latencyMs: 10,
    tunnelId: "tun-1",
    error: undefined,
    ...overrides,
  };
}

describe("computeTrafficStatistics", () => {
  it("returns zeroes for an empty record set", () => {
    const stats = computeTrafficStatistics([], { nowMs: 60_000 });

    expect(stats).toEqual({
      totalRequests: 0,
      requestsPerMinute: 0,
      averageLatencyMs: undefined,
      p95LatencyMs: undefined,
      errorRate: 0,
      methodCounts: [],
      statusCodeCounts: [],
      topEndpoints: [],
      tunnels: [],
    });
  });

  it("computes totals, latency, error rate, histograms, and top endpoints", () => {
    const stats = computeTrafficStatistics(
      [
        record({
          requestId: "1",
          timestamp: 50_000,
          method: HttpMethod.GET,
          path: "/a",
          status: 200,
          latencyMs: 10,
          tunnelId: "tun-1",
        }),
        record({
          requestId: "2",
          timestamp: 51_000,
          method: HttpMethod.GET,
          path: "/a",
          status: 200,
          latencyMs: 20,
          tunnelId: "tun-1",
        }),
        record({
          requestId: "3",
          timestamp: 52_000,
          method: HttpMethod.POST,
          path: "/b",
          status: 500,
          latencyMs: 30,
          tunnelId: "tun-2",
        }),
        record({
          requestId: "4",
          timestamp: 53_000,
          method: HttpMethod.GET,
          path: "/a",
          status: undefined,
          latencyMs: undefined,
          error: "timeout",
          tunnelId: "tun-1",
        }),
        record({
          requestId: "5",
          timestamp: 54_000,
          method: HttpMethod.PUT,
          path: "/c",
          status: 201,
          latencyMs: 40,
          tunnelId: "tun-2",
        }),
      ],
      { nowMs: 60_000, topEndpointsLimit: 2 },
    );

    expect(stats.totalRequests).toBe(5);
    expect(stats.requestsPerMinute).toBe(5);
    expect(stats.averageLatencyMs).toBe(25);
    expect(stats.p95LatencyMs).toBe(40);
    expect(stats.errorRate).toBe(2 / 5);
    expect(stats.methodCounts).toEqual([
      { method: "GET", count: 3 },
      { method: "POST", count: 1 },
      { method: "PUT", count: 1 },
    ]);
    expect(stats.statusCodeCounts).toEqual([
      { statusCode: 200, count: 2 },
      { statusCode: 201, count: 1 },
      { statusCode: 500, count: 1 },
    ]);
    expect(stats.topEndpoints).toEqual([
      { method: "GET", path: "/a", count: 3 },
      { method: "POST", path: "/b", count: 1 },
    ]);
    expect(stats.tunnels.map((tunnel) => tunnel.tunnelId)).toEqual(["tun-1", "tun-2"]);
    expect(stats.tunnels[0]).toEqual(
      expect.objectContaining({
        tunnelId: "tun-1",
        totalRequests: 3,
        errorRate: 1 / 3,
      }),
    );
  });

  it("scales requestsPerMinute for non-60s windows", () => {
    const stats = computeTrafficStatistics(
      [record({ requestId: "1", timestamp: 1_000 }), record({ requestId: "2", timestamp: 2_000 })],
      { nowMs: 30_000, requestsPerMinuteWindowMs: 30_000 },
    );

    expect(stats.requestsPerMinute).toBe(4);
  });

  it("excludes records outside the RPM window from requestsPerMinute", () => {
    const stats = computeTrafficStatistics(
      [
        record({ requestId: "old", timestamp: 1_000 }),
        record({ requestId: "new", timestamp: 90_000 }),
      ],
      { nowMs: 100_000 },
    );

    expect(stats.totalRequests).toBe(2);
    expect(stats.requestsPerMinute).toBe(1);
  });

  it("filters by sinceMs", () => {
    const stats = computeTrafficStatistics(
      [
        record({ requestId: "old", timestamp: 1_000 }),
        record({ requestId: "new", timestamp: 50_000 }),
      ],
      { sinceMs: 10_000, nowMs: 60_000, omitTunnelBreakdown: true },
    );

    expect(stats.totalRequests).toBe(1);
    expect(stats.tunnels).toEqual([]);
  });

  it("computes nearest-rank p95 across larger samples", () => {
    const records = Array.from({ length: 20 }, (_, index) =>
      record({
        requestId: `r-${String(index)}`,
        timestamp: 50_000 + index,
        latencyMs: index + 1,
      }),
    );

    const stats = computeTrafficStatistics(records, {
      nowMs: 60_000,
      omitTunnelBreakdown: true,
    });

    // ceil(0.95 * 20) - 1 = 18 → value 19
    expect(stats.p95LatencyMs).toBe(19);
  });

  it("rejects invalid window and limit options", () => {
    expect(() => computeTrafficStatistics([], { requestsPerMinuteWindowMs: 0 })).toThrow(
      /positive number/,
    );
    expect(() => computeTrafficStatistics([], { topEndpointsLimit: -1 })).toThrow(
      /non-negative integer/,
    );
  });
});
