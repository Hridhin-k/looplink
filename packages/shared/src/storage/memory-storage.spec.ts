import { describe, expect, it } from "vitest";

import { MemoryStorage } from "./memory-storage.js";
import { StorageFactory, createStorageProvider } from "./storage-factory.js";

describe("MemoryStorage", () => {
  it("saves and gets values by namespace and key", async () => {
    const storage = new MemoryStorage();

    await storage.save("traffic", "req-1", { status: 200, path: "/api" });
    await expect(storage.get("traffic", "req-1")).resolves.toEqual({
      status: 200,
      path: "/api",
    });
    await expect(storage.get("traffic", "missing")).resolves.toBeUndefined();
  });

  it("isolates namespaces", async () => {
    const storage = new MemoryStorage();

    await storage.save("a", "k", 1);
    await storage.save("b", "k", 2);

    await expect(storage.get("a", "k")).resolves.toBe(1);
    await expect(storage.get("b", "k")).resolves.toBe(2);
  });

  it("overwrites an existing key", async () => {
    const storage = new MemoryStorage();

    await storage.save("ns", "k", "one");
    await storage.save("ns", "k", "two");

    await expect(storage.get("ns", "k")).resolves.toBe("two");
  });

  it("lists keys with optional prefix and limit", async () => {
    const storage = new MemoryStorage();

    await storage.save("ns", "alpha", 1);
    await storage.save("ns", "beta", 2);
    await storage.save("ns", "alpine", 3);

    await expect(storage.list("ns")).resolves.toEqual(["alpha", "alpine", "beta"]);
    await expect(storage.list("ns", { prefix: "al" })).resolves.toEqual(["alpha", "alpine"]);
    await expect(storage.list("ns", { prefix: "al", limit: 1 })).resolves.toEqual(["alpha"]);
    await expect(storage.list("empty")).resolves.toEqual([]);
  });

  it("deletes keys and reports whether a value existed", async () => {
    const storage = new MemoryStorage();

    await storage.save("ns", "k", true);
    await expect(storage.delete("ns", "k")).resolves.toBe(true);
    await expect(storage.delete("ns", "k")).resolves.toBe(false);
    await expect(storage.get("ns", "k")).resolves.toBeUndefined();
  });

  it("clears a single namespace or the entire store", async () => {
    const storage = new MemoryStorage();

    await storage.save("a", "1", "x");
    await storage.save("b", "1", "y");

    await storage.clear("a");
    await expect(storage.list("a")).resolves.toEqual([]);
    await expect(storage.get("b", "1")).resolves.toBe("y");

    await storage.clear();
    await expect(storage.get("b", "1")).resolves.toBeUndefined();
  });

  it("defensive-copies values so callers cannot mutate the store", async () => {
    const storage = new MemoryStorage();
    const value = { nested: { n: 1 } };

    await storage.save("ns", "k", value);
    value.nested.n = 99;

    const stored = await storage.get<{ nested: { n: number } }>("ns", "k");
    expect(stored?.nested.n).toBe(1);

    if (stored !== undefined) {
      stored.nested.n = 42;
    }

    await expect(storage.get("ns", "k")).resolves.toEqual({ nested: { n: 1 } });
  });

  it("rejects empty namespace or key", async () => {
    const storage = new MemoryStorage();

    await expect(storage.save(" ", "k", 1)).rejects.toThrow(/namespace/);
    await expect(storage.save("ns", "  ", 1)).rejects.toThrow(/key/);
  });

  it("rejects a negative list limit", async () => {
    const storage = new MemoryStorage();
    await storage.save("ns", "k", 1);
    await expect(storage.list("ns", { limit: -1 })).rejects.toThrow(/limit/);
  });
});

describe("StorageFactory", () => {
  it("creates a memory provider by default", async () => {
    const provider = createStorageProvider();
    await provider.save("ns", "k", "v");
    await expect(provider.get("ns", "k")).resolves.toBe("v");
  });

  it("creates memory through StorageFactory.create", async () => {
    const factory = new StorageFactory();
    const provider = factory.create({ backend: "memory" });
    await provider.save("ns", "k", 7);
    await expect(provider.get("ns", "k")).resolves.toBe(7);
  });

  it("fails fast for reserved but unimplemented backends", () => {
    const factory = new StorageFactory();

    for (const backend of ["sqlite", "postgres", "redis", "s3"] as const) {
      expect(() => factory.create({ backend })).toThrow(
        new RegExp(`Storage backend "${backend}" is reserved`),
      );
    }
  });
});
