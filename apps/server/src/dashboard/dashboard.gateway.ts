import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";

import { Inject, Logger, type OnModuleDestroy, type OnModuleInit } from "@nestjs/common";
import {
  WebSocketGateway,
  type OnGatewayConnection,
  type OnGatewayDisconnect,
} from "@nestjs/websockets";
import {
  BadgerEventType,
  DASHBOARD_WS_PATH,
  DashboardMessageType,
  EVENT_BUS,
  mapReplayCompletedToDashboard,
  mapRequestReceivedToDashboard,
  mapResponseReturnedToDashboard,
  mapStatisticsUpdatedToDashboard,
  mapTunnelClosedToDashboard,
  mapTunnelCreatedToDashboard,
  parseDashboardMessage,
  type DashboardMessage,
  type EventBus,
  type EventSubscription,
} from "@hridhin-k/badger-shared";
import WebSocket from "ws";

import { ContextResolver } from "../context/context.resolver.js";
import { ContextSessionStore } from "../context/providers/context-session.store.js";
import { rawDataToString } from "../utils/raw-data.js";

/** How often the gateway probes dashboard clients. */
const DASHBOARD_PING_INTERVAL_MS = 30_000;

/**
 * Live WebSocket fan-out for the Badger dashboard.
 *
 * Path: `/dashboard/ws`. Consumes the shared {@link EventBus} only — never the
 * HTTP forward pipeline. Clients should reconnect automatically after disconnect
 * (see {@link import("@hridhin-k/badger-shared").DashboardLiveClient}).
 */
@WebSocketGateway({
  path: DASHBOARD_WS_PATH,
  maxPayload: 64 * 1024,
})
export class DashboardGateway
  implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy
{
  private readonly logger = new Logger(DashboardGateway.name);
  private readonly clients = new Set<WebSocket>();
  private readonly clientWorkspaceScope = new Map<WebSocket, string>();
  private readonly subscriptions: EventSubscription[] = [];
  private pingTimer: ReturnType<typeof setInterval> | undefined;

  /**
   * @param eventBus - Shared lifecycle bus.
   */
  constructor(
    @Inject(EVENT_BUS) private readonly eventBus: EventBus,
    private readonly contextResolver: ContextResolver,
    private readonly contextSessions: ContextSessionStore,
  ) {}

  /**
   * Subscribes to dashboard-relevant EventBus topics.
   */
  onModuleInit(): void {
    this.subscriptions.push(
      this.eventBus.subscribe(BadgerEventType.TunnelCreated, (event) => {
        this.broadcast(mapTunnelCreatedToDashboard(event));
      }),
      this.eventBus.subscribe(BadgerEventType.TunnelClosed, (event) => {
        this.broadcast(mapTunnelClosedToDashboard(event));
      }),
      this.eventBus.subscribe(BadgerEventType.RequestReceived, (event) => {
        this.broadcast(mapRequestReceivedToDashboard(event));
      }),
      this.eventBus.subscribe(BadgerEventType.ResponseReturned, (event) => {
        this.broadcast(mapResponseReturnedToDashboard(event));
      }),
      this.eventBus.subscribe(BadgerEventType.ReplayCompleted, (event) => {
        this.broadcast(mapReplayCompletedToDashboard(event));
      }),
      this.eventBus.subscribe(BadgerEventType.StatisticsUpdated, (event) => {
        this.broadcast(mapStatisticsUpdatedToDashboard(event));
      }),
    );

    this.pingTimer = setInterval(() => {
      this.broadcast({
        type: DashboardMessageType.Ping,
        occurredAt: Date.now(),
      });
    }, DASHBOARD_PING_INTERVAL_MS);
  }

  /**
   * Drops EventBus subscriptions and ping timer.
   */
  onModuleDestroy(): void {
    for (const subscription of this.subscriptions) {
      subscription.unsubscribe();
    }
    this.subscriptions.length = 0;

    if (this.pingTimer !== undefined) {
      clearInterval(this.pingTimer);
      this.pingTimer = undefined;
    }
  }

  /**
   * Registers a dashboard client after Context Engine admission.
   */
  async handleConnection(client: WebSocket, request?: IncomingMessage): Promise<void> {
    if (request === undefined) {
      client.close(1008, "Unauthorized.");
      return;
    }

    try {
      const context = await this.contextResolver.resolveDashboardWebSocket(request);
      if (context.workspaceId === null) {
        client.close(1008, "Unauthorized.");
        return;
      }
      this.clients.add(client);
      this.clientWorkspaceScope.set(client, context.workspaceId);
      this.contextSessions.bind(client, context);
    } catch {
      client.close(1008, "Unauthorized.");
      return;
    }

    this.logger.log(`Dashboard client connected (${String(this.clients.size)} active)`);

    this.send(client, {
      type: DashboardMessageType.Connected,
      occurredAt: Date.now(),
      connectionId: randomUUID(),
    });

    client.on("message", (data: WebSocket.RawData) => {
      this.handleClientMessage(client, data);
    });

    client.on("error", (error) => {
      this.logger.warn(`Dashboard WebSocket error: ${error.message}`);
    });
  }

  /**
   * Removes a disconnected dashboard client and destroys its context binding.
   *
   * @param client - Disconnected WebSocket.
   */
  handleDisconnect(client: WebSocket): void {
    this.clients.delete(client);
    this.clientWorkspaceScope.delete(client);
    this.contextSessions.destroy(client);
    this.logger.log(`Dashboard client disconnected (${String(this.clients.size)} active)`);
  }

  /**
   * @returns Number of currently connected dashboard clients (tests).
   */
  connectedClientCount(): number {
    return this.clients.size;
  }

  private handleClientMessage(_client: WebSocket, data: WebSocket.RawData): void {
    const raw = rawDataToString(data);

    let parsed: unknown;
    try {
      parsed = JSON.parse(raw) as unknown;
    } catch {
      return;
    }

    const message = parseDashboardMessage(parsed);
    if (message === undefined) {
      return;
    }

    // Pong (and other client→server frames) are acknowledged by presence only.
    if (message.type === DashboardMessageType.Pong) {
      return;
    }
  }

  private broadcast(message: DashboardMessage): void {
    // Keepalive frames are not workspace-scoped.
    if (
      message.type === DashboardMessageType.Ping ||
      message.type === DashboardMessageType.Connected
    ) {
      for (const client of [...this.clients]) {
        this.send(client, message);
      }
      return;
    }

    const workspaceId = workspaceScopeFromMessage(message);
    // Deny-by-default: never fan out unscoped traffic/stats/tunnel events
    // (anonymous tunnels must not leak into authenticated dashboard sessions).
    if (workspaceId === undefined) {
      return;
    }

    for (const client of [...this.clients]) {
      const clientScope = this.clientWorkspaceScope.get(client);
      if (clientScope !== workspaceId) {
        continue;
      }
      this.send(client, message);
    }
  }

  private send(client: WebSocket, message: DashboardMessage): void {
    if (client.readyState !== WebSocket.OPEN) {
      this.clients.delete(client);
      this.clientWorkspaceScope.delete(client);
      return;
    }

    try {
      client.send(JSON.stringify(message));
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to send dashboard message: ${detail}`);
      this.clients.delete(client);
      this.clientWorkspaceScope.delete(client);
    }
  }
}

function workspaceScopeFromMessage(message: DashboardMessage): string | undefined {
  switch (message.type) {
    case DashboardMessageType.TunnelConnected:
    case DashboardMessageType.TunnelDisconnected:
    case DashboardMessageType.RequestReceived:
    case DashboardMessageType.ResponseCompleted:
    case DashboardMessageType.ReplayCompleted:
    case DashboardMessageType.StatisticsUpdated:
      return message.workspaceId;
    default:
      return undefined;
  }
}
