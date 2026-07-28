import { describe, expect, it } from "vitest";

import { HttpMethod } from "../types/http-forwarding.js";
import { createTrafficBody } from "../traffic/traffic-body.js";
import type { TrafficRecord } from "../traffic/traffic-record.js";
import { mapTrafficRecordToForwardRequest } from "./map-traffic-record.js";
import { ReplayErrorCode } from "./replay-types.js";
import { websocketUrlToHttpBaseUrl } from "./websocket-url-to-http.js";

/**
 * Builds a traffic record for mapping tests.
 *
 * @param overrides - Fields to replace.
 * @returns Complete record.
 */
function record(overrides: Partial<TrafficRecord> = {}): TrafficRecord {
  return {
    requestId: "req-1",
    timestamp: 1,
    method: HttpMethod.POST,
    path: "/echo",
    headers: { accept: "text/plain", cookie: "a=1; b=2" },
    query: { q: "1" },
    body: createTrafficBody("ping"),
    status: 200,
    responseHeaders: {},
    responseBody: createTrafficBody(undefined),
    latencyMs: 1,
    tunnelId: "tun-1",
    error: undefined,
    ...overrides,
  };
}

describe("mapTrafficRecordToForwardRequest", () => {
  it("maps method, path, query, headers, cookies, and body", () => {
    const mapped = mapTrafficRecordToForwardRequest(record());

    expect(mapped.method).toBe(HttpMethod.POST);
    expect(mapped.path).toBe("/echo");
    expect(mapped.query).toEqual({ q: "1" });
    expect(mapped.headers).toEqual({ accept: "text/plain" });
    expect(mapped.cookies).toEqual({ a: "1", b: "2" });
    expect(mapped.body).toEqual(new Uint8Array([112, 105, 110, 103]));
    expect(mapped.requestBodyTruncated).toBe(false);
  });

  it("omits empty bodies", () => {
    const mapped = mapTrafficRecordToForwardRequest(
      record({ method: HttpMethod.GET, body: createTrafficBody(undefined) }),
    );

    expect(mapped.body).toBeUndefined();
  });

  it("supports PUT, PATCH, and DELETE", () => {
    for (const method of [HttpMethod.PUT, HttpMethod.PATCH, HttpMethod.DELETE]) {
      expect(mapTrafficRecordToForwardRequest(record({ method })).method).toBe(method);
    }
  });
});

describe("websocketUrlToHttpBaseUrl", () => {
  it("converts ws and wss origins", () => {
    expect(websocketUrlToHttpBaseUrl("ws://127.0.0.1:8080")).toBe("http://127.0.0.1:8080");
    expect(websocketUrlToHttpBaseUrl("wss://example.com/path")).toBe("https://example.com");
  });

  it("rejects non-websocket schemes", () => {
    expect(() => websocketUrlToHttpBaseUrl("https://example.com")).toThrow(/WebSocket URL/);
  });
});

describe("ReplayErrorCode", () => {
  it("exposes stable codes", () => {
    expect(ReplayErrorCode.NotFound).toBe("NOT_FOUND");
    expect(ReplayErrorCode.TunnelUnavailable).toBe("TUNNEL_UNAVAILABLE");
  });
});
