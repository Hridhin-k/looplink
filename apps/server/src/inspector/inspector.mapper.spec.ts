import {
  HttpMethod,
  createTrafficBody,
  type ReplayResponseDto,
  type TrafficRecord,
  type TrafficStatistics,
} from "@hridhin-k/badger-shared";
import { describe, expect, it } from "vitest";

import {
  toInspectorReplayResponseDto,
  toInspectorRequestDetail,
  toInspectorRequestList,
  toInspectorStatisticsDto,
} from "./inspector.mapper.js";

/**
 * Builds a traffic record for mapper tests.
 *
 * @param overrides - Fields to replace.
 * @returns Complete record.
 */
function record(overrides: Partial<TrafficRecord> = {}): TrafficRecord {
  return {
    requestId: "req-1",
    timestamp: 1_000,
    method: HttpMethod.GET,
    path: "/a",
    headers: { accept: "text/plain" },
    query: { q: "1" },
    body: createTrafficBody("hi"),
    status: 200,
    responseHeaders: { "x-test": "1" },
    responseBody: createTrafficBody("ok"),
    latencyMs: 12,
    tunnelId: "tun-1",
    error: undefined,
    ...overrides,
  };
}

describe("inspector.mapper", () => {
  it("maps list summaries without body payloads", () => {
    const list = toInspectorRequestList([record()]);

    expect(list.count).toBe(1);
    expect(list.items[0]).toEqual({
      id: "req-1",
      timestamp: 1_000,
      method: "GET",
      path: "/a",
      status: 200,
      latencyMs: 12,
      tunnelId: "tun-1",
      requestBodyByteLength: 2,
      responseBodyByteLength: 2,
    });
  });

  it("maps full request detail including bodies", () => {
    const detail = toInspectorRequestDetail(record({ error: "boom", status: undefined }));

    expect(detail.id).toBe("req-1");
    expect(detail.headers).toEqual({ accept: "text/plain" });
    expect(detail.body.dataBase64.length).toBeGreaterThan(0);
    expect(detail.error).toBe("boom");
    expect(detail.status).toBeUndefined();
  });

  it("maps statistics and replay DTOs", () => {
    const stats: TrafficStatistics = {
      totalRequests: 1,
      requestsPerMinute: 1,
      averageLatencyMs: 10,
      p95LatencyMs: 10,
      errorRate: 0,
      methodCounts: [{ method: "GET", count: 1 }],
      statusCodeCounts: [{ statusCode: 200, count: 1 }],
      topEndpoints: [{ method: "GET", path: "/", count: 1 }],
      tunnels: [
        {
          tunnelId: "tun-1",
          totalRequests: 1,
          averageLatencyMs: 10,
          p95LatencyMs: 10,
          errorRate: 0,
          methodCounts: [{ method: "GET", count: 1 }],
          statusCodeCounts: [{ statusCode: 200, count: 1 }],
          topEndpoints: [{ method: "GET", path: "/", count: 1 }],
        },
      ],
    };

    expect(toInspectorStatisticsDto(stats).tunnels[0]?.tunnelId).toBe("tun-1");

    const replay: ReplayResponseDto = {
      originalRequestId: "req-1",
      tunnelId: "tun-1",
      method: "GET",
      path: "/",
      statusCode: 200,
      headers: {},
      setCookies: [],
      bodyBase64: "",
      bodyByteLength: 0,
      bodyTruncated: false,
      requestBodyTruncated: false,
    };

    expect(toInspectorReplayResponseDto(replay).originalRequestId).toBe("req-1");
  });
});
