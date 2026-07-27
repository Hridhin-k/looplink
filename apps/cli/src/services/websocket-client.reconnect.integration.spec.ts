import { randomUUID } from "node:crypto";
import { createServer, type Server as HttpServer } from "node:http";

import {
  MessageType,
  TUNNEL_RECLAIM_WINDOW_MS,
  parseProtocolMessage,
  type ProtocolMessage,
} from "@hridhin-k/badger-shared";
import { afterEach, describe, expect, it, vi } from "vitest";
import { WebSocket, WebSocketServer } from "ws";

import { ConnectionState } from "./connection-state.js";
import { BadgerWebSocketClient } from "./websocket-client.js";
import { rawDataToString } from "../utils/raw-data.js";

interface Orphan {
  readonly id: string;
  readonly port: number;
  readonly publicUrl: string;
  readonly disconnectedAt: number;
}

interface ActiveTunnel {
  readonly id: string;
  readonly port: number;
  readonly publicUrl: string;
  readonly client: WebSocket;
}

/**
 * Minimal Badger control-plane server that mirrors production reclaim rules.
 *
 * Used only by reconnect integration tests so the CLI client can be exercised
 * against a real WebSocket peer without pulling in NestJS.
 */
class ReclaimTestServer {
  private readonly httpServer: HttpServer;
  private readonly wss: WebSocketServer;
  private readonly active = new Map<WebSocket, ActiveTunnel>();
  private readonly orphans = new Map<string, Orphan>();
  private port = 0;

  constructor(private readonly reclaimWindowMs = TUNNEL_RECLAIM_WINDOW_MS) {
    this.httpServer = createServer();
    this.wss = new WebSocketServer({ server: this.httpServer });
    this.wss.on("connection", (socket) => {
      this.handleConnection(socket);
    });
  }

  async listen(): Promise<string> {
    await new Promise<void>((resolve) => {
      this.httpServer.listen(0, "127.0.0.1", () => {
        resolve();
      });
    });

    const address = this.httpServer.address();
    if (address === null || typeof address === "string") {
      throw new Error("Expected a TCP listen address.");
    }

    this.port = address.port;
    return `ws://127.0.0.1:${String(this.port)}`;
  }

  async close(): Promise<void> {
    for (const client of this.wss.clients) {
      client.terminate();
    }

    await new Promise<void>((resolve, reject) => {
      this.wss.close((error) => {
        if (error) {
          reject(error);
          return;
        }
        this.httpServer.close((closeError) => {
          if (closeError) {
            reject(closeError);
            return;
          }
          resolve();
        });
      });
    });
  }

  /** Force-drop every connected client to simulate a network interruption. */
  dropAllClients(): void {
    for (const client of [...this.wss.clients]) {
      client.terminate();
    }
  }

  private handleConnection(socket: WebSocket): void {
    const connectionId = randomUUID();
    this.send(socket, { type: MessageType.Connected, connectionId });

    socket.on("message", (data) => {
      const parsed = parseProtocolMessage(rawDataToString(data));
      if (!parsed.ok) {
        this.send(socket, {
          type: MessageType.Error,
          code: "invalid_message",
          message: parsed.error,
        });
        return;
      }

      this.route(socket, parsed.value);
    });

    socket.on("close", () => {
      this.orphanClient(socket);
    });
  }

  private route(socket: WebSocket, message: ProtocolMessage): void {
    switch (message.type) {
      case MessageType.Ping:
        this.send(socket, { type: MessageType.Pong, requestId: message.requestId });
        return;
      case MessageType.CreateTunnel: {
        const now = Date.now();
        this.purgeExpired(now);

        let tunnel: ActiveTunnel | undefined;

        if (message.tunnelId !== undefined) {
          const orphan = this.orphans.get(message.tunnelId);
          if (
            orphan !== undefined &&
            orphan.port === message.port &&
            now - orphan.disconnectedAt <= this.reclaimWindowMs
          ) {
            this.orphans.delete(orphan.id);
            tunnel = {
              id: orphan.id,
              port: orphan.port,
              publicUrl: orphan.publicUrl,
              client: socket,
            };
          }
        }

        tunnel ??= {
          id: randomUUID(),
          port: message.port,
          publicUrl: `https://${randomUUID().slice(0, 8)}.badger.dev`,
          client: socket,
        };

        this.active.set(socket, tunnel);
        this.send(socket, {
          type: MessageType.TunnelCreated,
          requestId: message.requestId,
          tunnelId: tunnel.id,
          publicUrl: tunnel.publicUrl,
        });
        return;
      }
      default:
        this.send(socket, {
          type: MessageType.Error,
          code: "unsupported_message",
          message: `Unsupported message type "${message.type}".`,
        });
    }
  }

  private orphanClient(socket: WebSocket): void {
    const tunnel = this.active.get(socket);
    if (tunnel === undefined) {
      return;
    }

    this.active.delete(socket);
    this.orphans.set(tunnel.id, {
      id: tunnel.id,
      port: tunnel.port,
      publicUrl: tunnel.publicUrl,
      disconnectedAt: Date.now(),
    });
  }

  private purgeExpired(now: number): void {
    for (const [id, orphan] of this.orphans) {
      if (now - orphan.disconnectedAt > this.reclaimWindowMs) {
        this.orphans.delete(id);
      }
    }
  }

  private send(socket: WebSocket, message: ProtocolMessage): void {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(JSON.stringify(message));
    }
  }
}

async function waitFor(predicate: () => boolean, timeoutMs = 5_000, pollMs = 25): Promise<void> {
  const started = Date.now();

  while (!predicate()) {
    if (Date.now() - started > timeoutMs) {
      throw new Error("Timed out waiting for condition.");
    }
    await new Promise((resolve) => {
      setTimeout(resolve, pollMs);
    });
  }
}

describe("BadgerWebSocketClient reconnect (integration)", () => {
  const servers: ReclaimTestServer[] = [];
  const clients: BadgerWebSocketClient[] = [];

  afterEach(async () => {
    for (const client of clients.splice(0)) {
      await client.disconnect();
    }
    for (const server of servers.splice(0)) {
      await server.close();
    }
  });

  it("reconnects every 5 seconds and restores the previous tunnel", async () => {
    const server = new ReclaimTestServer();
    servers.push(server);
    const url = await server.listen();

    const onConnectionLost = vi.fn();
    const onReconnected = vi.fn();
    const onReconnectFailed = vi.fn();

    const client = new BadgerWebSocketClient({
      url,
      reconnect: true,
      reconnectIntervalMs: 50,
      heartbeatIntervalMs: 60_000,
      onConnectionLost,
      onReconnected,
      onReconnectFailed,
    });
    clients.push(client);

    await client.connect();
    await client.waitForMessage((message) => message.type === MessageType.Connected);

    const created = await client.createTunnel(3000);
    const previousId = created.tunnelId;
    const previousUrl = created.publicUrl;

    server.dropAllClients();

    await waitFor(() => client.getState() === ConnectionState.Reconnecting);
    expect(onConnectionLost).toHaveBeenCalledTimes(1);

    await waitFor(() => onReconnected.mock.calls.length === 1);

    expect(onReconnectFailed).not.toHaveBeenCalled();
    expect(client.getState()).toBe(ConnectionState.Connected);

    const [tunnel, restored] = onReconnected.mock.calls[0] as [
      { tunnelId: string; publicUrl: string },
      boolean,
    ];

    expect(restored).toBe(true);
    expect(tunnel.tunnelId).toBe(previousId);
    expect(tunnel.publicUrl).toBe(previousUrl);
    expect(client.getActiveTunnel()?.tunnelId).toBe(previousId);
  });

  it("keeps retrying when the server is temporarily unavailable", async () => {
    const server = new ReclaimTestServer();
    servers.push(server);
    const url = await server.listen();

    const onReconnectFailed = vi.fn();
    const onReconnected = vi.fn();

    const client = new BadgerWebSocketClient({
      url,
      reconnect: true,
      reconnectIntervalMs: 40,
      heartbeatIntervalMs: 60_000,
      onReconnectFailed,
      onReconnected,
    });
    clients.push(client);

    await client.connect();
    await client.waitForMessage((message) => message.type === MessageType.Connected);
    await client.createTunnel(4000);

    await server.close();
    servers.splice(servers.indexOf(server), 1);

    await waitFor(() => onReconnectFailed.mock.calls.length >= 2);

    expect(client.getState()).toBe(ConnectionState.Reconnecting);
    expect(onReconnected).not.toHaveBeenCalled();

    await client.disconnect();
    expect(client.getState()).toBe(ConnectionState.Disconnected);
  });

  it("does not reconnect after an intentional disconnect", async () => {
    const server = new ReclaimTestServer();
    servers.push(server);
    const url = await server.listen();

    const onConnectionLost = vi.fn();

    const client = new BadgerWebSocketClient({
      url,
      reconnect: true,
      reconnectIntervalMs: 50,
      heartbeatIntervalMs: 60_000,
      onConnectionLost,
    });
    clients.push(client);

    await client.connect();
    await client.waitForMessage((message) => message.type === MessageType.Connected);
    await client.createTunnel(3000);
    await client.disconnect();

    await new Promise((resolve) => {
      setTimeout(resolve, 150);
    });

    expect(onConnectionLost).not.toHaveBeenCalled();
    expect(client.getState()).toBe(ConnectionState.Disconnected);
  });

  it("creates a new tunnel when the previous one can no longer be reclaimed", async () => {
    const server = new ReclaimTestServer(30);
    servers.push(server);
    const url = await server.listen();

    const onReconnected = vi.fn();

    const client = new BadgerWebSocketClient({
      url,
      reconnect: true,
      reconnectIntervalMs: 80,
      heartbeatIntervalMs: 60_000,
      onReconnected,
    });
    clients.push(client);

    await client.connect();
    await client.waitForMessage((message) => message.type === MessageType.Connected);

    const created = await client.createTunnel(3000);
    server.dropAllClients();

    // Wait past the reclaim window before the reconnect attempt lands.
    await new Promise((resolve) => {
      setTimeout(resolve, 50);
    });

    await waitFor(() => onReconnected.mock.calls.length === 1);

    const [tunnel, restored] = onReconnected.mock.calls[0] as [{ tunnelId: string }, boolean];

    expect(restored).toBe(false);
    expect(tunnel.tunnelId).not.toBe(created.tunnelId);
  });
});
