import { randomUUID } from "node:crypto";
import type { IncomingMessage } from "node:http";

import { Logger } from "@nestjs/common";
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway } from "@nestjs/websockets";
import {
  MAX_WS_MESSAGE_BYTES,
  MessageType,
  parseProtocolMessage,
  type ConnectedMessage,
  type CreateTunnelMessage,
  type ErrorMessage,
  type HttpForwardingMessage,
  type PingMessage,
  type PongMessage,
  type ProtocolMessage,
  type TunnelCreatedMessage,
} from "@hridhin-k/badger-shared";
import WebSocket from "ws";

import { ContextFactory } from "../context/context.factory.js";
import { ContextResolver } from "../context/context.resolver.js";
import { ContextSessionStore } from "../context/providers/context-session.store.js";
import {
  contextHasPermission,
  contextLogFields,
} from "../context/tunnel-context.interface.js";
import { ownershipAccountId, toTunnelOwnership } from "../context/to-tunnel-ownership.js";
import { HeartbeatMonitor } from "./heartbeat.monitor.js";
import { HttpExchangeCoordinator } from "../http-forward/http-exchange.coordinator.js";
import { GatewaySecurityPolicy } from "../security/gateway-security.policy.js";
import { TunnelManager } from "../tunnel/tunnel.manager.js";
import { rawDataToString } from "../utils/raw-data.js";

/**
 * WebSocket entry point for Badger CLI clients.
 *
 * Admission goes through the Context Engine. Business tunnel creation consumes
 * only {@link import("../context/tunnel-context.interface.js").TunnelContext}.
 */
@WebSocketGateway({
  path: "/",
  maxPayload: MAX_WS_MESSAGE_BYTES,
})
export class TunnelGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(TunnelGateway.name);

  constructor(
    private readonly contextResolver: ContextResolver,
    private readonly contextFactory: ContextFactory,
    private readonly contextSessions: ContextSessionStore,
    private readonly tunnelManager: TunnelManager,
    private readonly httpExchanges: HttpExchangeCoordinator,
    private readonly heartbeats: HeartbeatMonitor,
    private readonly security: GatewaySecurityPolicy,
  ) {}

  async handleConnection(client: WebSocket, request: IncomingMessage): Promise<void> {
    const rejected = this.security.admit(client, request);
    if (rejected !== undefined) {
      this.logger.warn(`Rejected WebSocket connection: ${rejected}`);
      client.close(1008, rejected);
      return;
    }

    try {
      const context = await this.contextResolver.resolveTunnelWebSocket(request);
      this.contextSessions.bind(client, context);
    } catch (error: unknown) {
      const detail = error instanceof Error ? error.message : "Unauthorized.";
      this.logger.warn(`Rejected WebSocket authentication: ${detail}`);
      const message =
        detail.includes("anonymous") || detail.includes("Anonymous")
          ? "Invalid or expired anonymous session."
          : detail.includes("Malformed")
            ? "Malformed Authorization header."
            : detail.includes("Authentication required")
              ? "Authentication required."
              : "Unauthorized. Run `badger login` and try again.";
      client.close(1008, message);
      return;
    }

    const connectionId = randomUUID();
    const bound = this.contextSessions.require(client);
    this.logger.log(
      `Client connected (${connectionId}, contextId=${bound.contextId}, type=${bound.contextType})`,
    );
    this.heartbeats.register(client);

    const message: ConnectedMessage = {
      type: MessageType.Connected,
      connectionId,
    };

    this.sendMessage(client, message);

    client.on("message", (data: WebSocket.RawData) => {
      this.handleClientMessage(client, data);
    });

    client.on("error", (error) => {
      this.logger.warn(`WebSocket error: ${error.message}`);
    });
  }

  handleDisconnect(client: WebSocket): void {
    this.heartbeats.unregister(client);
    this.security.release(client);
    this.contextSessions.destroy(client);

    const detached = this.tunnelManager.detachClient(client);

    if (detached) {
      this.logger.log("Client disconnected; tunnel parked for reclaim");
    } else {
      this.logger.log("Client disconnected");
    }
  }

  private handleClientMessage(client: WebSocket, data: WebSocket.RawData): void {
    const parsed = parseProtocolMessage(rawDataToString(data));

    if (!parsed.ok) {
      if (!this.security.allowMessage(client)) {
        this.sendMessage(client, {
          type: MessageType.Error,
          code: "rate_limited",
          message: "WebSocket message rate limit exceeded.",
        });
        return;
      }

      this.sendMessage(client, {
        type: MessageType.Error,
        code: "invalid_message",
        message: parsed.error,
      });
      return;
    }

    const message = parsed.value;

    if (!isHttpDataPlaneFromClient(message) && !this.security.allowMessage(client)) {
      this.sendMessage(client, {
        type: MessageType.Error,
        code: "rate_limited",
        message: "WebSocket message rate limit exceeded.",
      });
      return;
    }

    switch (message.type) {
      case MessageType.CreateTunnel:
        this.handleCreateTunnel(client, message);
        return;
      case MessageType.Ping:
        this.handlePing(client, message);
        return;
      case MessageType.HttpResponseStart:
      case MessageType.HttpResponseChunk:
      case MessageType.HttpResponseEnd:
      case MessageType.HttpCancel:
        this.deliverOwnedHttpFrame(client, message);
        return;
      case MessageType.Error:
        if (!this.httpExchanges.deliver(message)) {
          this.logger.warn(`Unhandled error from client: ${message.message}`);
        }
        return;
      default:
        this.sendMessage(client, {
          type: MessageType.Error,
          code: "unsupported_message",
          message: `Unsupported message type "${message.type}".`,
        });
    }
  }

  private deliverOwnedHttpFrame(client: WebSocket, message: HttpForwardingMessage): void {
    const tunnel = this.tunnelManager.lookup(message.tunnelId);
    if (tunnel?.client !== client) {
      this.sendMessage(client, {
        type: MessageType.Error,
        requestId: message.requestId,
        code: "unauthorized_tunnel",
        message: "HTTP frame tunnelId does not belong to this connection.",
      });
      return;
    }

    this.httpExchanges.deliver(message);
  }

  private handlePing(client: WebSocket, ping: PingMessage): void {
    this.heartbeats.beat(client);

    const reply: PongMessage = {
      type: MessageType.Pong,
      requestId: ping.requestId,
    };

    this.sendMessage(client, reply);
  }

  private handleCreateTunnel(client: WebSocket, request: CreateTunnelMessage): void {
    try {
      const context = this.contextSessions.get(client);
      if (context === undefined) {
        this.sendMessage(client, {
          type: MessageType.Error,
          requestId: request.requestId,
          code: "unauthorized",
          message: "Tunnel context required to create a tunnel.",
        });
        return;
      }

      if (!contextHasPermission(context, "tunnel:create")) {
        this.sendMessage(client, {
          type: MessageType.Error,
          requestId: request.requestId,
          code: "forbidden",
          message: "Insufficient workspace permissions to create a tunnel.",
        });
        return;
      }

      const ownerUserId = ownershipAccountId(context);
      const created = this.tunnelManager.create(client, request.port, {
        context: toTunnelOwnership(context),
        ...(request.tunnelId === undefined ? {} : { preferredTunnelId: request.tunnelId }),
        ...(ownerUserId === undefined ? {} : { ownerUserId }),
      });

      const bound = this.contextFactory.withTunnelId(context, created.tunnel.id);
      this.contextSessions.replace(client, bound);

      const response: TunnelCreatedMessage = {
        type: MessageType.TunnelCreated,
        requestId: request.requestId,
        tunnelId: created.tunnel.id,
        publicUrl: created.publicUrl,
      };

      const action = created.restored ? "restored" : "created";
      this.logger.log(
        `Tunnel ${action} (${created.tunnel.id}) for port ${String(request.port)} → ${created.publicUrl} ${JSON.stringify(contextLogFields(bound))}`,
      );
      this.sendMessage(client, response);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Failed to create tunnel.";

      const response: ErrorMessage = {
        type: MessageType.Error,
        requestId: request.requestId,
        code: "tunnel_create_failed",
        message,
      };

      this.sendMessage(client, response);
    }
  }

  private sendMessage(client: WebSocket, message: ProtocolMessage): void {
    if (client.readyState !== WebSocket.OPEN) {
      this.logger.warn(`Skipped send; socket not open (readyState=${String(client.readyState)})`);
      return;
    }

    client.send(JSON.stringify(message));
  }
}

function isHttpDataPlaneFromClient(message: ProtocolMessage): boolean {
  return (
    message.type === MessageType.HttpResponseStart ||
    message.type === MessageType.HttpResponseChunk ||
    message.type === MessageType.HttpResponseEnd ||
    message.type === MessageType.HttpCancel
  );
}
