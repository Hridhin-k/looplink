import { afterEach, describe, expect, it } from "vitest";

import {
  buildPublicUrl,
  extractTunnelSlugFromHost,
  parseTunnelPath,
  resolvePublicUrlMode,
  tunnelSlug,
} from "./public-url.js";

describe("tunnelSlug", () => {
  it("strips dashes and truncates to 16 hex characters", () => {
    expect(tunnelSlug("abcd1234567890abcdef1234567890ab")).toBe("abcd1234567890ab");
    expect(tunnelSlug("ABCD-1234-5678-90AB-CDEF-1234-5678-90AB")).toBe("abcd1234567890ab");
  });
});

describe("buildPublicUrl", () => {
  it("builds a path-based URL by default", () => {
    expect(buildPublicUrl("abcd1234567890abcdef1234567890ab")).toBe(
      "https://badger.dev/tunnel/abcd1234567890abcdef1234567890ab",
    );
  });

  it("builds a subdomain URL when mode is subdomain", () => {
    expect(
      buildPublicUrl("abcd1234567890abcdef1234567890ab", {
        mode: "subdomain",
      }),
    ).toBe("https://abcd1234567890ab.badger.dev");
  });

  it("accepts an override base domain for path mode", () => {
    expect(
      buildPublicUrl("abcd1234567890abcdef1234567890ab", {
        baseDomain: "app.up.railway.app",
        mode: "path",
      }),
    ).toBe("https://app.up.railway.app/tunnel/abcd1234567890abcdef1234567890ab");
  });

  it("accepts an override base domain for subdomain mode", () => {
    expect(
      buildPublicUrl("abcd1234567890abcdef1234567890ab", {
        baseDomain: "example.test",
        mode: "subdomain",
      }),
    ).toBe("https://abcd1234567890ab.example.test");
  });
});

describe("parseTunnelPath", () => {
  const id = "abcd1234567890abcdef1234567890ab";

  it("rewrites /tunnel/{id}/products to /products", () => {
    expect(parseTunnelPath(`/tunnel/${id}/products`)).toEqual({
      tunnelId: id,
      localPath: "/products",
    });
  });

  it("rewrites /tunnel/{id} to /", () => {
    expect(parseTunnelPath(`/tunnel/${id}`)).toEqual({
      tunnelId: id,
      localPath: "/",
    });
  });

  it("preserves nested paths and trailing segments", () => {
    expect(parseTunnelPath(`/tunnel/${id}/api/v1/items`)).toEqual({
      tunnelId: id,
      localPath: "/api/v1/items",
    });
  });

  it("rejects malformed tunnel ids and non-tunnel paths", () => {
    expect(parseTunnelPath("/tunnel/short")).toBeUndefined();
    expect(parseTunnelPath("/tunnel/")).toBeUndefined();
    expect(parseTunnelPath("/health")).toBeUndefined();
    expect(parseTunnelPath(`/other/${id}/x`)).toBeUndefined();
  });
});

describe("extractTunnelSlugFromHost", () => {
  it("extracts the slug from a tunnel host", () => {
    expect(extractTunnelSlugFromHost("abcd1234567890ab.badger.dev")).toBe("abcd1234567890ab");
    expect(extractTunnelSlugFromHost("ABCD1234567890AB.badger.dev:8080")).toBe(
      "abcd1234567890ab",
    );
  });

  it("returns undefined for non-tunnel hosts", () => {
    expect(extractTunnelSlugFromHost("localhost:8080")).toBeUndefined();
    expect(extractTunnelSlugFromHost("badger.dev")).toBeUndefined();
    expect(extractTunnelSlugFromHost("a.b.badger.dev")).toBeUndefined();
  });
});

describe("resolvePublicUrlMode", () => {
  afterEach(() => {
    delete process.env["BADGER_PUBLIC_URL_MODE"];
  });

  it("defaults to path", () => {
    delete process.env["BADGER_PUBLIC_URL_MODE"];
    expect(resolvePublicUrlMode()).toBe("path");
  });

  it("reads subdomain from the environment", () => {
    process.env["BADGER_PUBLIC_URL_MODE"] = "subdomain";
    expect(resolvePublicUrlMode()).toBe("subdomain");
  });

  it("rejects unknown values", () => {
    process.env["BADGER_PUBLIC_URL_MODE"] = "wildcard";
    expect(() => resolvePublicUrlMode()).toThrow(/BADGER_PUBLIC_URL_MODE/);
  });
});
