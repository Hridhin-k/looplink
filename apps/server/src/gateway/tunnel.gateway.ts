import { randomUUID } from "node:crypto";

import { Logger } from "@nestjs/common";
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway } from "@nestjs/websockets";
import {
  MessageType,
  parseProtocolMessage,
  type ConnectedMessage,
  type CreateTunnelMessage,
  type ErrorMessage,
  type ProtocolMessage,
  type TunnelCreatedMessage,
} from "@looplink/shared";
import WebSocket from "ws";

import { HttpExchangeCoordinator } from "../http-forward/http-exchange.coordinator.js";
import { TunnelManager } from "../tunnel/tunnel.manager.js";
import { rawDataToString } from "../utils/raw-data.js";

/**
 * WebSocket entry point for LoopLink CLI clients.
 *
 * Accepts connections, handles tunnel creation, and delivers HTTP response
 * frames to {@link HttpExchangeCoordinator}.
 */
@WebSocketGateway()
export class TunnelGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private readonly logger = new Logger(TunnelGateway.name);

  /**
   * @param tunnelManager - Domain service that creates and tracks tunnels.
   * @param httpExchanges - Pending HTTP forward correlation registry.
   */
  constructor(
    private readonly tunnelManager: TunnelManager,
    private readonly httpExchanges: HttpExchangeCoordinator,
  ) {}

  /**
   * Handles a newly accepted WebSocket client.
   *
   * @param client - The connected `ws` client socket.
   */
  handleConnection(client: WebSocket): void {
    const connectionId = randomUUID();

    this.logger.log(`Client connected (${connectionId})`);

    const message: ConnectedMessage = {
      type: MessageType.Connected,
      connectionId,
    };

    this.sendMessage(client, message);

    client.on("message", (data: WebSocket.RawData) => {
      this.handleClientMessage(client, data);
    });
  }

  /**
   * Cleans up tunnel state when a client disconnects.
   *
   * @param client - The disconnected `ws` client socket.
   */
  handleDisconnect(client: WebSocket): void {
    const removed = this.tunnelManager.unregisterClient(client);

    if (removed) {
      this.logger.log("Client disconnected; tunnel unregistered");
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
      this.sendMessage(client, {
        type: MessageType.Error,
        code: "invalid_message",
        message: parsed.error,
      });
      return;
    }

    const message = parsed.value;

    switch (message.type) {
      case MessageType.CreateTunnel:
        this.handleCreateTunnel(client, message);
        return;
      case MessageType.HttpResponseStart:
      case MessageType.HttpResponseChunk:
      case MessageType.HttpResponseEnd:
      case MessageType.HttpCancel:
        this.httpExchanges.deliver(message);
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
   * Creates a tunnel for the requesting client and replies with its public URL.
   *
   * @param client - Requesting WebSocket client.
   * @param request - Parsed create-tunnel request.
   */
  private handleCreateTunnel(client: WebSocket, request: CreateTunnelMessage): void {
    try {
      const created = this.tunnelManager.create(client, request.port);

      const response: TunnelCreatedMessage = {
        type: MessageType.TunnelCreated,
        requestId: request.requestId,
        tunnelId: created.tunnel.id,
        publicUrl: created.publicUrl,
      };

      this.logger.log(
        `Tunnel created (${created.tunnel.id}) for port ${String(request.port)} → ${created.publicUrl}`,
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
