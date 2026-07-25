import { WebSocketGateway } from "@nestjs/websockets";

/**
 * WebSocket entry point for LoopLink CLI clients.
 *
 * Tunnel protocol handling is intentionally omitted for now; this gateway only
 * registers the WebSocket upgrade path so the transport is wired and ready.
 */
@WebSocketGateway()
export class TunnelGateway {}
