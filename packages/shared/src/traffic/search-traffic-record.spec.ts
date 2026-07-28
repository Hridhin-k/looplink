import { describe, expect, it } from "vitest";

import { HttpMethod } from "../types/http-forwarding.js";
import { createTrafficBody } from "./traffic-body.js";
import { matchTrafficRecordFields, searchTrafficRecords } from "./search-traffic-record.js";
import type { TrafficRecord } from "./traffic-record.js";

function record(overrides: Partial<TrafficRecord> = {}): TrafficRecord {
  return {
    requestId: "req-1",
    timestamp: Date.parse("2024-06-15T12:34:56.000Z"),
    method: HttpMethod.POST,
    path: "/api/users",
    headers: { accept: "application/json", "x-request-id": "abc-123" },
    query: { page: "1" },
    body: createTrafficBody('{"name":"ada"}'),
    status: 201,
    responseHeaders: { "content-type": "application/json" },
    responseBody: createTrafficBody('{"ok":true}'),
    latencyMs: 42,
    tunnelId: "tun-west-1",
    error: undefined,
    ...overrides,
  };
}

describe("matchTrafficRecordFields", () => {
  it("returns undefined for empty queries", () => {
    expect(matchTrafficRecordFields(record(), "   ")).toBeUndefined();
  });

  it("matches url, method, tunnel, status, headers, body, and response", () => {
    expect(matchTrafficRecordFields(record(), "users")).toEqual(["url"]);
    expect(matchTrafficRecordFields(record(), "post")).toEqual(["method"]);
    expect(matchTrafficRecordFields(record(), "tun-west")).toEqual(["tunnel"]);
    expect(matchTrafficRecordFields(record(), "201")).toEqual(["status"]);
    expect(matchTrafficRecordFields(record(), "x-request-id")).toEqual(["headers"]);
    expect(matchTrafficRecordFields(record(), "ada")).toEqual(["body"]);
    expect(matchTrafficRecordFields(record(), '"ok":true')).toEqual(["response"]);
  });

  it("matches timestamps by ISO fragment", () => {
    expect(matchTrafficRecordFields(record(), "2024-06-15")).toEqual(["timestamp"]);
  });

  it("returns multiple fields when the query hits several", () => {
    const fields = matchTrafficRecordFields(record(), "json");
    expect(fields).toEqual(expect.arrayContaining(["headers", "response"]));
  });
});

describe("searchTrafficRecords", () => {
  it("filters to matching records and preserves order", () => {
    const records = [
      record({ requestId: "a", path: "/alpha", timestamp: 3 }),
      record({ requestId: "b", path: "/beta", timestamp: 2 }),
      record({ requestId: "c", path: "/alpha/2", timestamp: 1 }),
    ];

    expect(searchTrafficRecords(records, "alpha").map((hit) => hit.requestId)).toEqual(["a", "c"]);
  });
});
