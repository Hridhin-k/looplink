import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Heartbeat } from "./heartbeat.js";

describe("Heartbeat", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("beats every 30 seconds by default", () => {
    const beat = vi.fn();
    const heartbeat = new Heartbeat(beat);

    heartbeat.start();

    vi.advanceTimersByTime(29_999);
    expect(beat).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1);
    expect(beat).toHaveBeenCalledTimes(1);

    vi.advanceTimersByTime(60_000);
    expect(beat).toHaveBeenCalledTimes(3);

    heartbeat.stop();
  });

  it("respects a custom interval", () => {
    const beat = vi.fn();
    const heartbeat = new Heartbeat(beat, 5_000);

    heartbeat.start();
    vi.advanceTimersByTime(15_000);

    expect(beat).toHaveBeenCalledTimes(3);

    heartbeat.stop();
  });

  it("does not stack timers when started twice", () => {
    const beat = vi.fn();
    const heartbeat = new Heartbeat(beat, 10_000);

    heartbeat.start();
    heartbeat.start();

    vi.advanceTimersByTime(10_000);
    expect(beat).toHaveBeenCalledTimes(1);

    heartbeat.stop();
  });

  it("stops beating after stop()", () => {
    const beat = vi.fn();
    const heartbeat = new Heartbeat(beat, 10_000);

    heartbeat.start();
    vi.advanceTimersByTime(10_000);
    expect(beat).toHaveBeenCalledTimes(1);

    heartbeat.stop();
    vi.advanceTimersByTime(60_000);
    expect(beat).toHaveBeenCalledTimes(1);
  });

  it("reports its running state", () => {
    const heartbeat = new Heartbeat(vi.fn(), 10_000);

    expect(heartbeat.isRunning()).toBe(false);

    heartbeat.start();
    expect(heartbeat.isRunning()).toBe(true);

    heartbeat.stop();
    expect(heartbeat.isRunning()).toBe(false);
  });

  it("is safe to stop when never started", () => {
    const heartbeat = new Heartbeat(vi.fn());

    expect(() => {
      heartbeat.stop();
    }).not.toThrow();
  });
});
