import { describe, expect, it, vi } from "vitest";

import { DisabledDatabaseClient } from "./disabled-database.client.js";
import { createRepositoryToken, type EntityRepository } from "./repositories/repository.js";
import { SupabaseDatabaseClient } from "./supabase-database.client.js";

describe("DisabledDatabaseClient", () => {
  it("rejects ping when Supabase is not configured", async () => {
    const client = new DisabledDatabaseClient();
    await expect(client.ping()).rejects.toThrow(/Supabase is not configured/);
  });
});

describe("SupabaseDatabaseClient", () => {
  it("resolves when auth.getSession succeeds", async () => {
    const client = new SupabaseDatabaseClient({
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      },
    } as never);

    await expect(client.ping()).resolves.toBeUndefined();
  });

  it("throws when auth.getSession returns an error", async () => {
    const client = new SupabaseDatabaseClient({
      auth: {
        getSession: vi.fn().mockResolvedValue({
          data: { session: null },
          error: { message: "Invalid API key" },
        }),
      },
    } as never);

    await expect(client.ping()).rejects.toThrow(/Invalid API key/);
  });
});

describe("repository abstraction", () => {
  it("creates unique Symbol tokens per repository name", () => {
    const a = createRepositoryToken("workspace");
    const b = createRepositoryToken("workspace");
    expect(a).not.toBe(b);
    expect(String(a)).toContain("workspace");
  });

  it("types EntityRepository as an async findById port", async () => {
    const repo: EntityRepository<{ id: string }> = {
      findById: async (id) => (id === "1" ? { id: "1" } : undefined),
    };

    await expect(repo.findById("1")).resolves.toEqual({ id: "1" });
    await expect(repo.findById("missing")).resolves.toBeUndefined();
  });
});
