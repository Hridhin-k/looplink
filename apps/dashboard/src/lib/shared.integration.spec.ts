import { BadgerEventType, MessageType } from "@hridhin-k/badger-shared";
import { describe, expect, it } from "vitest";

import { resolveDashboardServerConfig } from "../config/server.js";

/**
 * Proves the dashboard can consume `@hridhin-k/badger-shared` without importing
 * server internals, and that env config stays isolated from the tunnel stack.
 */
describe("dashboard shared package integration", () => {
  it("imports stable shared protocol and event contracts", () => {
    expect(MessageType.Connected).toBe("connected");
    expect(BadgerEventType.TunnelCreated).toBe("TunnelCreated");
  });

  it("resolves server endpoints independently of tunnel internals", () => {
    const config = resolveDashboardServerConfig({
      NEXT_PUBLIC_BADGER_API_URL: "http://127.0.0.1:8080",
      NEXT_PUBLIC_BADGER_WS_URL: "ws://127.0.0.1:8080",
    });

    expect(config.apiBaseUrl).toBe("http://127.0.0.1:8080");
    expect(config.wsBaseUrl).toBe("ws://127.0.0.1:8080");
  });
});
