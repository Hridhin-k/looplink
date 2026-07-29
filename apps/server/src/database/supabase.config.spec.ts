import { afterEach, describe, expect, it } from "vitest";

import { resolveSupabaseConfig } from "./supabase.config.js";

function clearSupabaseEnv(): void {
  delete process.env.SUPABASE_URL;
  delete process.env.SUPABASE_ANON_KEY;
  delete process.env.SUPABASE_SERVICE_ROLE_KEY;
}

describe("resolveSupabaseConfig", () => {
  afterEach(() => {
    clearSupabaseEnv();
  });

  it("returns disabled when no Supabase env vars are set", () => {
    clearSupabaseEnv();
    expect(resolveSupabaseConfig()).toEqual({ enabled: false });
  });

  it("requires all three vars when any one is set", () => {
    clearSupabaseEnv();
    process.env["SUPABASE_URL"] = "https://example.supabase.co";

    expect(() => resolveSupabaseConfig()).toThrow(/SUPABASE_ANON_KEY/);
    expect(() => resolveSupabaseConfig()).toThrow(/SUPABASE_SERVICE_ROLE_KEY/);
  });

  it("validates the project URL protocol", () => {
    clearSupabaseEnv();
    process.env["SUPABASE_URL"] = "ftp://example.supabase.co";
    process.env["SUPABASE_ANON_KEY"] = "anon-key-with-enough-length";
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "service-role-key-long-enough";

    expect(() => resolveSupabaseConfig()).toThrow(/http: or https:/);
  });

  it("rejects short API keys", () => {
    clearSupabaseEnv();
    process.env["SUPABASE_URL"] = "https://example.supabase.co";
    process.env["SUPABASE_ANON_KEY"] = "short";
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "service-role-key-long-enough";

    expect(() => resolveSupabaseConfig()).toThrow(/SUPABASE_ANON_KEY/);
  });

  it("returns enabled config with a normalized URL", () => {
    clearSupabaseEnv();
    process.env["SUPABASE_URL"] = "https://example.supabase.co/";
    process.env["SUPABASE_ANON_KEY"] = "anon-key-with-enough-length";
    process.env["SUPABASE_SERVICE_ROLE_KEY"] = "service-role-key-long-enough";

    expect(resolveSupabaseConfig()).toEqual({
      enabled: true,
      url: "https://example.supabase.co",
      anonKey: "anon-key-with-enough-length",
      serviceRoleKey: "service-role-key-long-enough",
    });
  });
});
