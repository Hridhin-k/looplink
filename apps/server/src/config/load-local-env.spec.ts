import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { loadLocalEnv } from "./load-local-env.js";

const originalCwd = process.cwd();
let previousPort: string | undefined;
let previousSupabaseUrl: string | undefined;
let previousPublicDomain: string | undefined;

function snapshotEnv(): void {
  previousPort = process.env.PORT;
  previousSupabaseUrl = process.env.SUPABASE_URL;
  previousPublicDomain = process.env.BADGER_PUBLIC_BASE_DOMAIN;
  delete process.env.PORT;
  delete process.env.SUPABASE_URL;
  delete process.env.BADGER_PUBLIC_BASE_DOMAIN;
}

function restoreEnv(): void {
  process.chdir(originalCwd);
  if (previousPort === undefined) {
    delete process.env.PORT;
  } else {
    process.env.PORT = previousPort;
  }
  if (previousSupabaseUrl === undefined) {
    delete process.env.SUPABASE_URL;
  } else {
    process.env.SUPABASE_URL = previousSupabaseUrl;
  }
  if (previousPublicDomain === undefined) {
    delete process.env.BADGER_PUBLIC_BASE_DOMAIN;
  } else {
    process.env.BADGER_PUBLIC_BASE_DOMAIN = previousPublicDomain;
  }
}

describe("loadLocalEnv", () => {
  afterEach(() => {
    restoreEnv();
  });

  it("loads .env.local from the working directory", () => {
    snapshotEnv();

    const dir = mkdtempSync(join(tmpdir(), "badger-env-"));
    writeFileSync(
      join(dir, ".env.local"),
      ["PORT=18080", "SUPABASE_URL=https://example.supabase.co", "# comment", ""].join("\n"),
      "utf8",
    );
    process.chdir(dir);

    loadLocalEnv();

    expect(process.env.PORT).toBe("18080");
    expect(process.env.SUPABASE_URL).toBe("https://example.supabase.co");
  });

  it("does not overwrite existing process.env values", () => {
    snapshotEnv();
    process.env.PORT = "9999";

    const dir = mkdtempSync(join(tmpdir(), "badger-env-"));
    writeFileSync(join(dir, ".env.local"), "PORT=18080\n", "utf8");
    process.chdir(dir);

    loadLocalEnv();

    expect(process.env.PORT).toBe("9999");
  });

  it("prefers .env.local over .env", () => {
    snapshotEnv();

    const dir = mkdtempSync(join(tmpdir(), "badger-env-"));
    writeFileSync(join(dir, ".env"), "BADGER_PUBLIC_BASE_DOMAIN=from-env\n", "utf8");
    writeFileSync(join(dir, ".env.local"), "BADGER_PUBLIC_BASE_DOMAIN=from-local\n", "utf8");
    process.chdir(dir);

    loadLocalEnv();

    expect(process.env.BADGER_PUBLIC_BASE_DOMAIN).toBe("from-local");
  });
});
