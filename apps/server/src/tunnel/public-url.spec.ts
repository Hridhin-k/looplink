import { describe, expect, it } from "vitest";

import { buildPublicUrl, extractTunnelSlugFromHost, tunnelSlug } from "./public-url.js";

describe("tunnelSlug", () => {
  it("strips dashes and truncates to 8 characters", () => {
    expect(tunnelSlug("abcd1234-5678-4abc-8def-0123456789ab")).toBe("abcd1234");
  });
});

describe("buildPublicUrl", () => {
  it("builds an https subdomain URL from the tunnel id slug", () => {
    expect(buildPublicUrl("abcd1234-5678-4abc-8def-0123456789ab")).toBe(
      "https://abcd1234.looplink.dev",
    );
  });

  it("accepts an override base domain", () => {
    expect(buildPublicUrl("abcd1234-5678-4abc-8def-0123456789ab", "example.test")).toBe(
      "https://abcd1234.example.test",
    );
  });
});

describe("extractTunnelSlugFromHost", () => {
  it("extracts the slug from a tunnel host", () => {
    expect(extractTunnelSlugFromHost("abcd1234.looplink.dev")).toBe("abcd1234");
    expect(extractTunnelSlugFromHost("ABCD1234.looplink.dev:8080")).toBe("abcd1234");
  });

  it("returns undefined for non-tunnel hosts", () => {
    expect(extractTunnelSlugFromHost("localhost:8080")).toBeUndefined();
    expect(extractTunnelSlugFromHost("looplink.dev")).toBeUndefined();
    expect(extractTunnelSlugFromHost("a.b.looplink.dev")).toBeUndefined();
  });
});
