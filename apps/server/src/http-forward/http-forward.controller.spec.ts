import { describe, expect, it } from "vitest";

import { isReservedManagementPath } from "./http-forward.controller.js";

describe("isReservedManagementPath", () => {
  it("reserves inspector and swagger prefixes only", () => {
    expect(isReservedManagementPath("/api/v1")).toBe(true);
    expect(isReservedManagementPath("/api/v1/inspector/requests")).toBe(true);
    expect(isReservedManagementPath("/api/docs")).toBe(true);
    expect(isReservedManagementPath("/api/docs/swagger")).toBe(true);
  });

  it("allows application /api routes through the tunnel", () => {
    expect(isReservedManagementPath("/api")).toBe(false);
    expect(isReservedManagementPath("/api/data")).toBe(false);
    expect(isReservedManagementPath("/api/v2/items")).toBe(false);
    expect(isReservedManagementPath("/health")).toBe(false);
  });
});
