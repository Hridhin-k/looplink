import { describe, expect, it } from "vitest";

import { buildPublicUrl } from "./public-url.js";

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
