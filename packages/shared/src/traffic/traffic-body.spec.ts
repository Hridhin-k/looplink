import { describe, expect, it } from "vitest";

import {
  EMPTY_TRAFFIC_BODY,
  capTrafficBody,
  createTrafficBody,
  trafficBodyToBytes,
} from "./traffic-body.js";

describe("createTrafficBody", () => {
  it("encodes utf8 strings as base64", () => {
    const body = createTrafficBody("ping");

    expect(body.byteLength).toBe(4);
    expect(body.truncated).toBe(false);
    expect(trafficBodyToBytes(body)).toEqual(new Uint8Array([112, 105, 110, 103]));
  });

  it("returns the shared empty body for empty input", () => {
    expect(createTrafficBody(undefined)).toBe(EMPTY_TRAFFIC_BODY);
    expect(createTrafficBody("")).toBe(EMPTY_TRAFFIC_BODY);
    expect(createTrafficBody(new Uint8Array())).toBe(EMPTY_TRAFFIC_BODY);
  });

  it("truncates oversized payloads while preserving original byteLength", () => {
    const body = createTrafficBody(new Uint8Array([1, 2, 3, 4, 5]), 3);

    expect(body.byteLength).toBe(5);
    expect(body.truncated).toBe(true);
    expect(trafficBodyToBytes(body)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it("rejects a negative maxBytes", () => {
    expect(() => createTrafficBody("x", -1)).toThrow(/non-negative integer/);
  });
});

describe("capTrafficBody", () => {
  it("re-truncates a previously encoded body", () => {
    const body = createTrafficBody(new Uint8Array([1, 2, 3, 4, 5]));
    const capped = capTrafficBody(body, 2);

    expect(capped.byteLength).toBe(5);
    expect(capped.truncated).toBe(true);
    expect(trafficBodyToBytes(capped)).toEqual(new Uint8Array([1, 2]));
  });
});
