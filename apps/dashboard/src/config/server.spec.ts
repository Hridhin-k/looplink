import { describe, expect, it } from "vitest";

import {
  DEFAULT_BADGER_API_URL,
  DEFAULT_BADGER_WS_URL,
  resolveDashboardServerConfig,
} from "./server.js";

describe("resolveDashboardServerConfig", () => {
  it("returns local development defaults when env vars are unset", () => {
    expect(resolveDashboardServerConfig({})).toEqual({
      apiBaseUrl: DEFAULT_BADGER_API_URL,
      wsBaseUrl: DEFAULT_BADGER_WS_URL,
    });
  });

  it("reads NEXT_PUBLIC_* values and strips trailing slashes", () => {
    expect(
      resolveDashboardServerConfig({
        NEXT_PUBLIC_BADGER_API_URL: "https://api.example.com/",
        NEXT_PUBLIC_BADGER_WS_URL: "wss://api.example.com/",
      }),
    ).toEqual({
      apiBaseUrl: "https://api.example.com",
      wsBaseUrl: "wss://api.example.com",
    });
  });

  it("treats blank strings as unset", () => {
    expect(
      resolveDashboardServerConfig({
        NEXT_PUBLIC_BADGER_API_URL: "   ",
        NEXT_PUBLIC_BADGER_WS_URL: "",
      }),
    ).toEqual({
      apiBaseUrl: DEFAULT_BADGER_API_URL,
      wsBaseUrl: DEFAULT_BADGER_WS_URL,
    });
  });
});
