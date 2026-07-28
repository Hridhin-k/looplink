import { describe, expect, it } from "vitest";

import { MemoryStorage } from "../storage/memory-storage.js";
import { HttpMethod } from "../types/http-forwarding.js";
import { StorageTrafficRecordStore } from "./storage-traffic-record-store.js";
import { createTrafficBody, trafficBodyToBytes } from "./traffic-body.js";
import type { TrafficRecord } from "./traffic-record.js";

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
    query: {},
    body: createTrafficBody(undefined),
    status: undefined,
    responseHeaders: {},
    responseBody: createTrafficBody(undefined),
    latencyMs: undefined,
    tunnelId: "tun-1",
    error: undefined,
    ...overrides,
  };
}

describe("StorageTrafficRecordStore", () => {
  it("saves and retrieves records by id", async () => {
    const store = new StorageTrafficRecordStore(new MemoryStorage());
    await store.save(record({ requestId: "a", path: "/a" }));

    await expect(store.findById("a")).resolves.toEqual(expect.objectContaining({ path: "/a" }));
    await expect(store.size()).resolves.toBe(1);
  });

  it("updates an existing record", async () => {
    const store = new StorageTrafficRecordStore(new MemoryStorage());
    await store.save(record({ requestId: "a" }));

    const updated = await store.update("a", {
      status: 201,
      responseHeaders: { "x-test": "1" },
      responseBody: createTrafficBody(new Uint8Array([1, 2])),
      latencyMs: 42,
    });

    expect(updated?.status).toBe(201);
    expect(updated?.latencyMs).toBe(42);
    await expect(store.findById("a")).resolves.toEqual(
      expect.objectContaining({
        responseHeaders: { "x-test": "1" },
      }),
    );
  });

  it("lists newest records first and supports tunnel filters", async () => {
    const store = new StorageTrafficRecordStore(new MemoryStorage());
    await store.save(record({ requestId: "1", tunnelId: "tun-a", timestamp: 1 }));
    await store.save(record({ requestId: "2", tunnelId: "tun-b", timestamp: 2 }));
    await store.save(record({ requestId: "3", tunnelId: "tun-a", timestamp: 3 }));

    const newest = await store.list({ limit: 2 });
    expect(newest.map((item) => item.requestId)).toEqual(["3", "2"]);

    const tunnelA = await store.list({ tunnelId: "tun-a" });
    expect(tunnelA.map((item) => item.requestId)).toEqual(["3", "1"]);
  });

  it("omits body payloads when includeBodies is false", async () => {
    const store = new StorageTrafficRecordStore(new MemoryStorage());
    await store.save(
      record({
        requestId: "a",
        body: createTrafficBody("hello"),
        responseBody: createTrafficBody("world"),
      }),
    );

    const [listed] = await store.list({ includeBodies: false });
    expect(listed?.body.byteLength).toBe(5);
    expect(listed?.body.dataBase64).toBe("");
    expect(listed?.responseBody.byteLength).toBe(5);
    expect(listed?.responseBody.dataBase64).toBe("");

    const full = await store.findById("a");
    expect(trafficBodyToBytes(full?.body ?? createTrafficBody(undefined))).toEqual(
      new Uint8Array([104, 101, 108, 108, 111]),
    );
  });

  it("evicts the oldest records when over capacity", async () => {
    const store = new StorageTrafficRecordStore(new MemoryStorage(), { maxRecords: 2 });
    await store.save(record({ requestId: "1" }));
    await store.save(record({ requestId: "2" }));
    await store.save(record({ requestId: "3" }));

    await expect(store.size()).resolves.toBe(2);
    await expect(store.findById("1")).resolves.toBeUndefined();
    await expect(store.findById("2")).resolves.toBeDefined();
    await expect(store.findById("3")).resolves.toBeDefined();
  });

  it("truncates oversized bodies", async () => {
    const store = new StorageTrafficRecordStore(new MemoryStorage(), { maxBodyBytes: 3 });
    await store.save(
      record({
        requestId: "a",
        body: createTrafficBody(new Uint8Array([1, 2, 3, 4, 5]), 64),
      }),
    );

    const saved = await store.findById("a");
    expect(saved?.body.byteLength).toBe(5);
    expect(saved?.body.truncated).toBe(true);
    expect(trafficBodyToBytes(saved?.body ?? createTrafficBody(undefined))).toEqual(
      new Uint8Array([1, 2, 3]),
    );
  });

  it("clears all records", async () => {
    const store = new StorageTrafficRecordStore(new MemoryStorage());
    await store.save(record());
    await store.clear();

    await expect(store.size()).resolves.toBe(0);
    await expect(store.list()).resolves.toEqual([]);
  });
});
