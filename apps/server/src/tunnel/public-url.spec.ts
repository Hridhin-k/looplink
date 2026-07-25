import { describe, expect, it } from "vitest";

import { buildPublicUrl, extractTunnelSlugFromHost, tunnelSlug } from "./public-url.js";

describe("tunnelSlug", () => {
  it("strips dashes and truncates to 16 hex characters", () => {
    expect(tunnelSlug("abcd1234567890abcdef1234567890ab")).toBe("abcd1234567890ab");
    expect(tunnelSlug("ABCD-1234-5678-90AB-CDEF-1234-5678-90AB")).toBe("abcd1234567890ab");
  });
});

describe("buildPublicUrl", () => {
  it("builds an https subdomain URL from the tunnel id slug", () => {
    expect(buildPublicUrl("abcd1234567890abcdef1234567890ab")).toBe(
      "https://abcd1234567890ab.looplink.dev",
    );
  });

  it("accepts an override base domain", () => {
    expect(buildPublicUrl("abcd1234567890abcdef1234567890ab", "example.test")).toBe(
      "https://abcd1234567890ab.example.test",
    );
  });
});

describe("extractTunnelSlugFromHost", () => {
  it("extracts the slug from a tunnel host", () => {
    expect(extractTunnelSlugFromHost("abcd1234567890ab.looplink.dev")).toBe("abcd1234567890ab");
    expect(extractTunnelSlugFromHost("ABCD1234567890AB.looplink.dev:8080")).toBe(
      "abcd1234567890ab",
    );
  });

  it("returns undefined for non-tunnel hosts", () => {
    expect(extractTunnelSlugFromHost("localhost:8080")).toBeUndefined();
    expect(extractTunnelSlugFromHost("looplink.dev")).toBeUndefined();
    expect(extractTunnelSlugFromHost("a.b.looplink.dev")).toBeUndefined();
  });
});
