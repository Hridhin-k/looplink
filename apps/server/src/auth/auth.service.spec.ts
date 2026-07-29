import { describe, expect, it, vi } from "vitest";

import { OriginValidator } from "../security/origin-validator.js";
import { AuthService } from "./auth.service.js";
import { extractBearerToken } from "./extract-bearer-token.js";

describe("extractBearerToken", () => {
  it("extracts a Bearer token", () => {
    expect(extractBearerToken("Bearer abc.def.ghi")).toBe("abc.def.ghi");
  });

  it("returns undefined for missing or malformed headers", () => {
    expect(extractBearerToken(undefined)).toBeUndefined();
    expect(extractBearerToken("Basic abc")).toBeUndefined();
    expect(extractBearerToken("Bearer ")).toBeUndefined();
  });
});

describe("AuthService", () => {
  it("maps a successful password login to an AuthSession", async () => {
    const anon = {
      auth: {
        signInWithPassword: vi.fn().mockResolvedValue({
          data: {
            session: {
              access_token: "access",
              refresh_token: "refresh",
              expires_at: 1_700_000_000,
            },
            user: { id: "user-1", email: "Dev@Example.com" },
          },
          error: null,
        }),
      },
    };

    const service = new AuthService(
      {
        enabled: true,
        url: "https://example.supabase.co",
        anonKey: "anon-key-with-enough-length",
        serviceRoleKey: "service-role-key-long-enough",
      },
      anon as never,
      {} as never,
      new OriginValidator(),
    );

    await expect(service.login("  Dev@Example.com ", "secret")).resolves.toEqual({
      accessToken: "access",
      refreshToken: "refresh",
      expiresAt: 1_700_000_000,
      user: { id: "user-1", email: "Dev@Example.com", authMethod: "jwt" },
    });
  });

  it("rejects login when Supabase is disabled", async () => {
    const service = new AuthService({ enabled: false }, null, null, new OriginValidator());
    await expect(service.login("a@b.com", "x")).rejects.toThrow(/Supabase is not configured/);
  });

  it("verifies an access token via getUser", async () => {
    const anon = {
      auth: {
        getUser: vi.fn().mockResolvedValue({
          data: { user: { id: "user-1", email: "a@b.com" } },
          error: null,
        }),
      },
    };

    const service = new AuthService(
      {
        enabled: true,
        url: "https://example.supabase.co",
        anonKey: "anon-key-with-enough-length",
        serviceRoleKey: "service-role-key-long-enough",
      },
      anon as never,
      {} as never,
      new OriginValidator(),
    );

    await expect(service.verifyAccessToken("jwt")).resolves.toEqual({
      id: "user-1",
      email: "a@b.com",
      authMethod: "jwt",
    });
  });
});
