import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type WebSocket from "ws";

import { HeartbeatMonitor } from "./heartbeat.monitor.js";

interface FakeClient {
  terminate: ReturnType<typeof vi.fn>;
}

function createClient(): FakeClient {
  return { terminate: vi.fn() };
}

function asSocket(client: FakeClient): WebSocket {
  return client as unknown as WebSocket;
}

describe("HeartbeatMonitor", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("terminates a client after 60 seconds without a heartbeat", () => {
    const monitor = new HeartbeatMonitor();
    const client = createClient();

    monitor.register(asSocket(client));

    // At exactly 60s the client is still within the timeout.
    vi.advanceTimersByTime(60_000);
    expect(client.terminate).not.toHaveBeenCalled();

    // The next sweep (default cadence: timeout / 4) finds it stale.
    vi.advanceTimersByTime(15_000);
    expect(client.terminate).toHaveBeenCalledTimes(1);
    expect(monitor.trackedClientCount()).toBe(0);

    monitor.onModuleDestroy();
  });

  it("keeps a client alive while heartbeats keep arriving", () => {
    const monitor = new HeartbeatMonitor();
    const client = createClient();
    const socket = asSocket(client);

    monitor.register(socket);

    // Simulate the CLI pinging every 30 seconds for three minutes.
    for (let i = 0; i < 6; i += 1) {
      vi.advanceTimersByTime(30_000);
      monitor.beat(socket);
    }

    expect(client.terminate).not.toHaveBeenCalled();

    // Once the beats stop, the timeout applies again.
    vi.advanceTimersByTime(75_000);
    expect(client.terminate).toHaveBeenCalledTimes(1);

    monitor.onModuleDestroy();
  });

  it("only terminates the stale client, not healthy ones", () => {
    const monitor = new HeartbeatMonitor();
    const stale = createClient();
    const healthy = createClient();

    monitor.register(asSocket(stale));
    monitor.register(asSocket(healthy));

    for (let i = 0; i < 3; i += 1) {
      vi.advanceTimersByTime(30_000);
      monitor.beat(asSocket(healthy));
    }

    expect(stale.terminate).toHaveBeenCalledTimes(1);
    expect(healthy.terminate).not.toHaveBeenCalled();
    expect(monitor.trackedClientCount()).toBe(1);

    monitor.onModuleDestroy();
  });

  it("does not terminate a client that disconnected normally", () => {
    const monitor = new HeartbeatMonitor();
    const client = createClient();
    const socket = asSocket(client);

    monitor.register(socket);
    monitor.unregister(socket);

    vi.advanceTimersByTime(120_000);

    expect(client.terminate).not.toHaveBeenCalled();
    expect(monitor.trackedClientCount()).toBe(0);
  });

  it("ignores beats from sockets it is not tracking", () => {
    const monitor = new HeartbeatMonitor();
    const client = createClient();

    monitor.beat(asSocket(client));

    expect(monitor.trackedClientCount()).toBe(0);
  });

  it("stops sweeping on module destroy", () => {
    const monitor = new HeartbeatMonitor();
    const client = createClient();

    monitor.register(asSocket(client));
    monitor.onModuleDestroy();

    vi.advanceTimersByTime(120_000);

    expect(client.terminate).not.toHaveBeenCalled();
  });

  it("supports custom timeout and sweep cadence", () => {
    const monitor = new HeartbeatMonitor(1_000, 250);
    const client = createClient();

    monitor.register(asSocket(client));

    vi.advanceTimersByTime(1_250);

    expect(client.terminate).toHaveBeenCalledTimes(1);

    monitor.onModuleDestroy();
  });
});
