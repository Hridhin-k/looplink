import { describe, expect, it } from "vitest";

import { ConnectionLimiter } from "./connection-limiter.js";
import { OriginValidator } from "./origin-validator.js";
import { SlidingWindowRateLimiter } from "./sliding-window-rate-limiter.js";

describe("SlidingWindowRateLimiter", () => {
  it("allows up to the configured number of events in a window", () => {
    let now = 1_000;
    const limiter = new SlidingWindowRateLimiter(2, 1_000, () => now);

    expect(limiter.attempt("a").allowed).toBe(true);
    expect(limiter.attempt("a").allowed).toBe(true);

    const denied = limiter.attempt("a");
    expect(denied.allowed).toBe(false);
    expect(denied.retryAfterMs).toBeGreaterThan(0);

    now = 2_001;
    expect(limiter.attempt("a").allowed).toBe(true);
  });

  it("isolates keys from each other", () => {
    const limiter = new SlidingWindowRateLimiter(1, 1_000);

    expect(limiter.attempt("a").allowed).toBe(true);
    expect(limiter.attempt("b").allowed).toBe(true);
    expect(limiter.attempt("a").allowed).toBe(false);
  });
});

describe("ConnectionLimiter", () => {
  it("enforces global and per-IP ceilings", () => {
    const limiter = new ConnectionLimiter(2, 1);

    expect(limiter.tryAdmit("1.1.1.1")).toEqual({ ok: true });
    expect(limiter.tryAdmit("1.1.1.1")).toEqual({ ok: false, reason: "ip_limit" });
    expect(limiter.tryAdmit("2.2.2.2")).toEqual({ ok: true });
    expect(limiter.tryAdmit("3.3.3.3")).toEqual({ ok: false, reason: "global_limit" });

    limiter.release("1.1.1.1");
    expect(limiter.tryAdmit("3.3.3.3")).toEqual({ ok: true });
  });
});

describe("OriginValidator", () => {
  it("allows all origins when the allow-list is empty", () => {
    const validator = new OriginValidator([]);

    expect(validator.isOriginAllowed("https://evil.example")).toBe(true);
    expect(validator.isOriginAllowed(undefined)).toBe(true);
  });

  it("allows missing Origin (CLI) but rejects disallowed browser Origins", () => {
    const validator = new OriginValidator(["https://badger.dev"]);

    expect(validator.isOriginAllowed(undefined)).toBe(true);
    expect(validator.isOriginAllowed("https://badger.dev")).toBe(true);
    expect(validator.isOriginAllowed("https://evil.example")).toBe(false);
  });

  it("accepts apex and tunnel hosts for the configured base domain", () => {
    const validator = new OriginValidator([]);

    expect(validator.isHostAllowed("badger.dev", "badger.dev")).toBe(true);
    expect(validator.isHostAllowed("abcd1234567890ab.badger.dev", "badger.dev")).toBe(true);
    expect(validator.isHostAllowed("evil.example", "badger.dev")).toBe(true);
  });

  it("rejects foreign hosts when an allow-list is configured", () => {
    const validator = new OriginValidator(["https://badger.dev"]);

    expect(validator.isHostAllowed("evil.example", "badger.dev")).toBe(false);
    expect(validator.isHostAllowed("abcd.badger.dev", "badger.dev")).toBe(true);
  });
});
