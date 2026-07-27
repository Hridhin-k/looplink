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
} from "@looplink/shared";
import WebSocket from "ws";

import { HeartbeatMonitor } from "./heartbeat.monitor.js";
import { HttpExchangeCoordinator } from "../http-forward/http-exchange.coordinator.js";
import { GatewaySecurityPolicy } from "../security/gateway-security.policy.js";
import { TunnelManager } from "../tunnel/tunnel.manager.js";
import { rawDataToString } from "../utils/raw-data.js";

/**
 * WebSocket entry point for LoopLink CLI clients.
 *
 * Accepts connections under connection/origin limits, enforces per-IP message
 * rate limits and frame size caps, handles tunnel creation, and delivers HTTP
 * response frames only when the sender owns the tunnel.
 */
@WebSocketGateway({
  // Bound every inbound frame before JSON parsing (DoS control).
  maxPayload: MAX_WS_MESSAGE_BYTES,
})
export class TunnelGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(TunnelGateway.name);

  /**
   * @param tunnelManager - Domain service that creates and tracks tunnels.
   * @param httpExchanges - Pending HTTP forward correlation registry.
   * @param heartbeats - Liveness tracker that drops silent clients.
   * @param security - Connection, origin, and message-rate policy.
   */
  constructor(
    private readonly tunnelManager: TunnelManager,
    private readonly httpExchanges: HttpExchangeCoordinator,
    private readonly heartbeats: HeartbeatMonitor,
    private readonly security: GatewaySecurityPolicy,
  ) {}

  /**
   * Handles a newly accepted WebSocket client.
   *
   * @param client - The connected `ws` client socket.
   * @param request - HTTP upgrade request (origin / IP).
   */
  handleConnection(client: WebSocket, request: IncomingMessage): void {
    const rejected = this.security.admit(client, request);
    if (rejected !== undefined) {
      this.logger.warn(`Rejected WebSocket connection: ${rejected}`);
      client.close(1008, rejected);
      return;
    }

    const connectionId = randomUUID();

    this.logger.log(`Client connected (${connectionId})`);
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

  /**
   * Cleans up tunnel state when a client disconnects.
   *
   * @param client - The disconnected `ws` client socket.
   */
  handleDisconnect(client: WebSocket): void {
    this.heartbeats.unregister(client);
    this.security.release(client);

    const detached = this.tunnelManager.detachClient(client);

    if (detached) {
      this.logger.log("Client disconnected; tunnel parked for reclaim");
    } else {
      this.logger.log("Client disconnected");
    }
  }

  /**
   * Routes an inbound protocol message from a connected client.
   *
   * @param client - Sender socket.
   * @param data - Raw WebSocket payload.
   */
  private handleClientMessage(client: WebSocket, data: WebSocket.RawData): void {
    const parsed = parseProtocolMessage(rawDataToString(data));

    if (!parsed.ok) {
      // Invalid frames still consume the control-plane budget so a flood of
      // garbage cannot bypass rate limiting by failing to parse.
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

    // HTTP response frames are volume-bound by public HTTP rate limits, body
    // caps, and pending-exchange limits. Counting them toward the WS control
    // budget breaks Next.js/Vite pages that fan out dozens of asset responses.
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

  /**
   * Delivers an HTTP response frame only when the sender owns the tunnel.
   *
   * @param client - Sending socket.
   * @param message - HTTP forwarding frame.
   */
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

  /**
   * Records a heartbeat and echoes the ping's `requestId` back as a `PONG`.
   *
   * @param client - The socket that sent the keepalive probe.
   * @param ping - Parsed ping message.
   */
  private handlePing(client: WebSocket, ping: PingMessage): void {
    this.heartbeats.beat(client);

    const reply: PongMessage = {
      type: MessageType.Pong,
      requestId: ping.requestId,
    };

    this.sendMessage(client, reply);
  }

  /**
   * Creates a tunnel for the requesting client and replies with its public URL.
   *
   * @param client - Requesting WebSocket client.
   * @param request - Parsed create-tunnel request.
   */
  private handleCreateTunnel(client: WebSocket, request: CreateTunnelMessage): void {
    try {
      const created = this.tunnelManager.create(
        client,
        request.port,
        request.tunnelId === undefined ? {} : { preferredTunnelId: request.tunnelId },
      );

      const response: TunnelCreatedMessage = {
        type: MessageType.TunnelCreated,
        requestId: request.requestId,
        tunnelId: created.tunnel.id,
        publicUrl: created.publicUrl,
      };

      const action = created.restored ? "restored" : "created";
      this.logger.log(
        `Tunnel ${action} (${created.tunnel.id}) for port ${String(request.port)} → ${created.publicUrl}`,
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

  /**
   * Serializes a protocol message and writes it to an open socket.
   *
   * @param client - Target WebSocket.
   * @param message - Protocol payload to send.
   */
  private sendMessage(client: WebSocket, message: ProtocolMessage): void {
    if (client.readyState !== WebSocket.OPEN) {
      this.logger.warn(`Skipped send; socket not open (readyState=${String(client.readyState)})`);
      return;
    }

    client.send(JSON.stringify(message));
  }
}

/**
 * HTTP data-plane frames the CLI sends while answering public requests.
 *
 * These are excluded from the WebSocket control-plane rate limit.
 *
 * @param message - Parsed protocol message.
 * @returns `true` for response/cancel frames.
 */
function isHttpDataPlaneFromClient(message: ProtocolMessage): boolean {
  return (
    message.type === MessageType.HttpResponseStart ||
    message.type === MessageType.HttpResponseChunk ||
    message.type === MessageType.HttpResponseEnd ||
    message.type === MessageType.HttpCancel
  );
}
