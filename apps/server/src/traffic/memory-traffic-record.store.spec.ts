import { HttpMethod } from "@hridhin-k/badger-shared";
import { describe, expect, it } from "vitest";

import { MemoryTrafficRecordStore } from "./memory-traffic-record.store.js";
import type { TrafficRecord } from "./traffic.types.js";

/**
 * Builds a minimal traffic record for store tests.
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
    body: new Uint8Array(),
    status: undefined,
    responseHeaders: {},
    responseBody: new Uint8Array(),
    latencyMs: undefined,
    tunnelId: "tun-1",
    error: undefined,
    ...overrides,
  };
}

describe("MemoryTrafficRecordStore", () => {
  it("saves and retrieves records by id", () => {
    const store = new MemoryTrafficRecordStore();
    store.save(record({ requestId: "a", path: "/a" }));

    expect(store.findById("a")?.path).toBe("/a");
    expect(store.size()).toBe(1);
  });

  it("updates an existing record", () => {
    const store = new MemoryTrafficRecordStore();
    store.save(record({ requestId: "a" }));

    const updated = store.update("a", {
      status: 201,
      responseHeaders: { "x-test": "1" },
      responseBody: new Uint8Array([1, 2]),
      latencyMs: 42,
    });

    expect(updated?.status).toBe(201);
    expect(updated?.latencyMs).toBe(42);
    expect(store.findById("a")?.responseHeaders).toEqual({ "x-test": "1" });
  });

  it("lists newest records first and supports tunnel filters", () => {
    const store = new MemoryTrafficRecordStore();
    store.save(record({ requestId: "1", tunnelId: "tun-a", timestamp: 1 }));
    store.save(record({ requestId: "2", tunnelId: "tun-b", timestamp: 2 }));
    store.save(record({ requestId: "3", tunnelId: "tun-a", timestamp: 3 }));

    expect(store.list({ limit: 2 }).map((item) => item.requestId)).toEqual(["3", "2"]);
    expect(store.list({ tunnelId: "tun-a" }).map((item) => item.requestId)).toEqual(["3", "1"]);
  });

  it("evicts the oldest records when over capacity", () => {
    const store = new MemoryTrafficRecordStore({ maxRecords: 2 });
    store.save(record({ requestId: "1" }));
    store.save(record({ requestId: "2" }));
    store.save(record({ requestId: "3" }));

    expect(store.size()).toBe(2);
    expect(store.findById("1")).toBeUndefined();
    expect(store.findById("2")).toBeDefined();
    expect(store.findById("3")).toBeDefined();
  });

  it("truncates oversized bodies", () => {
    const store = new MemoryTrafficRecordStore({ maxBodyBytes: 3 });
    store.save(
      record({
        requestId: "a",
        body: new Uint8Array([1, 2, 3, 4, 5]),
      }),
    );

    expect(store.findById("a")?.body).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("clears all records", () => {
    const store = new MemoryTrafficRecordStore();
    store.save(record());
    store.clear();

    expect(store.size()).toBe(0);
    expect(store.list()).toEqual([]);
  });
});
