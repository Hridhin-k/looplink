import { afterEach, describe, expect, it, vi } from "vitest";

import { resolveEnvPreferringBadger } from "./env.js";

describe("resolveEnvPreferringBadger", () => {
  afterEach(() => {
    delete process.env["BADGER_PUBLIC_BASE_DOMAIN"];
    delete process.env["LOOPLINK_PUBLIC_BASE_DOMAIN"];
  });

  it("prefers BADGER_* when both are set", () => {
    const warn = vi.fn();
    process.env["BADGER_PUBLIC_BASE_DOMAIN"] = "badger.dev";
    process.env["LOOPLINK_PUBLIC_BASE_DOMAIN"] = "legacy.dev";

    expect(
      resolveEnvPreferringBadger("BADGER_PUBLIC_BASE_DOMAIN", "LOOPLINK_PUBLIC_BASE_DOMAIN", {
        warn,
      }),
    ).toBe("badger.dev");
    expect(warn).not.toHaveBeenCalled();
  });

  it("falls back to LOOPLINK_* with a deprecation warning", () => {
    const warn = vi.fn();
    process.env["LOOPLINK_PUBLIC_BASE_DOMAIN"] = "legacy.dev";

    expect(
      resolveEnvPreferringBadger("BADGER_PUBLIC_BASE_DOMAIN", "LOOPLINK_PUBLIC_BASE_DOMAIN", {
        warn,
      }),
    ).toBe("legacy.dev");
    expect(warn).toHaveBeenCalledOnce();
    expect(warn.mock.calls[0]?.[0]).toMatch(/LOOPLINK_PUBLIC_BASE_DOMAIN.*deprecated/i);
  });

  it("returns undefined when neither is set", () => {
    expect(
      resolveEnvPreferringBadger("BADGER_PUBLIC_BASE_DOMAIN", "LOOPLINK_PUBLIC_BASE_DOMAIN"),
    ).toBeUndefined();
  });
});
