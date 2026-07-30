import { describe, expect, it, vi } from "vitest";

import { DASHBOARD_WS_PATH, DashboardMessageType } from "./dashboard-messages.js";
import { buildDashboardWebSocketUrl, DashboardLiveClient } from "./dashboard-live-client.js";
import { mapTunnelCreatedToDashboard } from "./map-dashboard-message.js";

describe("buildDashboardWebSocketUrl", () => {
  it("maps http(s) and ws(s) origins to /dashboard/ws", () => {
    expect(buildDashboardWebSocketUrl("http://127.0.0.1:8080")).toBe(
      `ws://127.0.0.1:8080${DASHBOARD_WS_PATH}`,
    );
    expect(buildDashboardWebSocketUrl("https://example.com")).toBe(
      `wss://example.com${DASHBOARD_WS_PATH}`,
    );
    expect(buildDashboardWebSocketUrl("wss://example.com/ignored")).toBe(
      `wss://example.com${DASHBOARD_WS_PATH}`,
    );
  });

  it("preserves auth and workspace query params", () => {
    expect(
      buildDashboardWebSocketUrl(
        "http://127.0.0.1:8080?access_token=tok&workspaceId=ws-1",
      ),
    ).toBe(`ws://127.0.0.1:8080${DASHBOARD_WS_PATH}?access_token=tok&workspaceId=ws-1`);
  });
});

describe("mapTunnelCreatedToDashboard", () => {
  it("maps tunnel created to tunnel_connected", () => {
    expect(
      mapTunnelCreatedToDashboard({
        eventId: "e1",
        occurredAt: 1,
        correlationId: "tun-1",
        tunnelId: "tun-1",
        publicUrl: "https://tun-1.example",
        port: 3000,
        restored: true,
      }),
    ).toEqual({
      type: DashboardMessageType.TunnelConnected,
      occurredAt: 1,
      tunnelId: "tun-1",
      publicUrl: "https://tun-1.example",
      port: 3000,
      restored: true,
    });
  });
});

describe("DashboardLiveClient", () => {
  it("auto-reconnects after close and replies to ping with pong", async () => {
    vi.useFakeTimers();

    const sockets: FakeBrowserSocket[] = [];

    class FakeBrowserSocket {
      readyState = 0;
      readonly listeners = new Map<string, Set<(event: { data?: unknown }) => void>>();

      constructor(readonly url: string) {
        sockets.push(this);
        queueMicrotask(() => {
          this.readyState = 1;
          this.emit("open");
        });
      }

      addEventListener(type: string, handler: (event: { data?: unknown }) => void): void {
        const set = this.listeners.get(type) ?? new Set();
        set.add(handler);
        this.listeners.set(type, set);
      }

      send = vi.fn();

      close(): void {
        this.readyState = 3;
        this.emit("close");
      }

      emit(type: string, data?: unknown): void {
        for (const handler of this.listeners.get(type) ?? []) {
          handler({ data });
        }
      }
    }

    const client = new DashboardLiveClient({
      url: "http://127.0.0.1:8080",
      reconnectIntervalMs: 1_000,
      WebSocketImpl: FakeBrowserSocket as unknown as typeof WebSocket,
    });

    const messages: string[] = [];
    client.subscribe((message) => {
      messages.push(message.type);
    });

    client.connect();
    expect(sockets).toHaveLength(1);
    expect(sockets[0]?.url).toContain(DASHBOARD_WS_PATH);

    await vi.runAllTimersAsync();

    sockets[0]?.emit("message", JSON.stringify({ type: DashboardMessageType.Ping, occurredAt: 1 }));
    expect(sockets[0]?.send).toHaveBeenCalledWith(
      expect.stringContaining(DashboardMessageType.Pong),
    );
    expect(messages).toContain(DashboardMessageType.Ping);

    sockets[0]?.close();
    expect(client.isConnected()).toBe(false);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(sockets).toHaveLength(2);

    client.disconnect();
    vi.useRealTimers();
  });

  it("invokes lifecycle callbacks and ignores stale close after reconnect", async () => {
    vi.useFakeTimers();

    const sockets: FakeBrowserSocket[] = [];
    const onOpen = vi.fn();
    const onClose = vi.fn();
    const onReconnecting = vi.fn();

    class FakeBrowserSocket {
      readyState = 0;
      readonly listeners = new Map<string, Set<(event: { data?: unknown }) => void>>();

      constructor(readonly url: string) {
        sockets.push(this);
        queueMicrotask(() => {
          this.readyState = 1;
          this.emit("open");
        });
      }

      addEventListener(type: string, handler: (event: { data?: unknown }) => void): void {
        const set = this.listeners.get(type) ?? new Set();
        set.add(handler);
        this.listeners.set(type, set);
      }

      send = vi.fn();

      close(): void {
        this.readyState = 3;
        this.emit("close");
      }

      emit(type: string, data?: unknown): void {
        for (const handler of this.listeners.get(type) ?? []) {
          handler({ data });
        }
      }
    }

    const client = new DashboardLiveClient({
      url: "http://127.0.0.1:8080",
      reconnectIntervalMs: 1_000,
      WebSocketImpl: FakeBrowserSocket as unknown as typeof WebSocket,
      onOpen,
      onClose,
      onReconnecting,
    });

    client.connect();
    await vi.runAllTimersAsync();
    expect(onOpen).toHaveBeenCalledTimes(1);

    sockets[0]?.close();
    expect(onClose).toHaveBeenCalledWith({ intentional: false });
    expect(onReconnecting).toHaveBeenCalledTimes(1);

    await vi.advanceTimersByTimeAsync(1_000);
    expect(sockets).toHaveLength(2);
    await vi.runAllTimersAsync();
    expect(onOpen).toHaveBeenCalledTimes(2);

    client.disconnect();
    client.connect();
    await vi.runAllTimersAsync();
    expect(sockets).toHaveLength(3);

    // Stale close from the previous socket must not schedule another reconnect cycle.
    const reconnectCallsBeforeStaleClose = onReconnecting.mock.calls.length;
    sockets[1]?.close();
    expect(onReconnecting.mock.calls.length).toBe(reconnectCallsBeforeStaleClose);

    client.disconnect();
    vi.useRealTimers();
  });
});
