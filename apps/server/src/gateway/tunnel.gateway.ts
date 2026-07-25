import { randomUUID } from "node:crypto";

import { Logger } from "@nestjs/common";
import { OnGatewayConnection, WebSocketGateway } from "@nestjs/websockets";
import { MessageType, type ConnectedMessage } from "@looplink/shared";
import WebSocket from "ws";

/**
 * WebSocket entry point for LoopLink CLI clients.
 *
 * Accepts connections, logs them, and sends a protocol {@link ConnectedMessage}.
 * Tunnel creation is intentionally omitted for now.
 */
@WebSocketGateway()
export class TunnelGateway implements OnGatewayConnection {
  private readonly logger = new Logger(TunnelGateway.name);

  /**
   * Handles a newly accepted WebSocket client.
   *
   * Assigns a connection id, logs the session, and immediately sends a
   * {@link ConnectedMessage} handshake over the socket.
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
  }

  /**
   * Serializes a protocol message and writes it to an open socket.
   *
   * @param client - Target WebSocket.
   * @param message - Protocol payload to send.
   */
  private sendMessage(client: WebSocket, message: ConnectedMessage): void {
    if (client.readyState !== WebSocket.OPEN) {
      this.logger.warn(
        `Skipped CONNECTED send; socket not open (readyState=${String(client.readyState)})`,
      );
      return;
    }

    client.send(JSON.stringify(message));
  }
}
