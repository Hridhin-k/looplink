import { Injectable } from "@nestjs/common";
import type WebSocket from "ws";

import type { TunnelContext } from "../tunnel-context.interface.js";

/**
 * Binds {@link TunnelContext} instances to WebSocket connection lifecycles.
 *
 * Not a global request context — keys are socket instances only. Entries must
 * be destroyed on disconnect to avoid dangling references.
 */
@Injectable()
export class ContextSessionStore {
  private readonly bySocket = new Map<WebSocket, TunnelContext>();

  /**
   * Stores an immutable context for a live socket.
   */
  bind(socket: WebSocket, context: TunnelContext): void {
    this.bySocket.set(socket, context);
  }

  /**
   * Replaces the bound context (for example after tunnel id assignment).
   */
  replace(socket: WebSocket, context: TunnelContext): void {
    if (!this.bySocket.has(socket)) {
      throw new Error("Cannot replace context for an unbound socket.");
    }
    this.bySocket.set(socket, context);
  }

  /**
   * Returns the context bound to `socket`, if any.
   */
  get(socket: WebSocket): TunnelContext | undefined {
    return this.bySocket.get(socket);
  }

  /**
   * Requires a bound context or throws.
   */
  require(socket: WebSocket): TunnelContext {
    const context = this.bySocket.get(socket);
    if (context === undefined) {
      throw new Error("Tunnel context required for this WebSocket session.");
    }
    return context;
  }

  /**
   * Destroys the binding for `socket`. Safe to call multiple times.
   */
  destroy(socket: WebSocket): void {
    this.bySocket.delete(socket);
  }

  /**
   * @returns Number of live bindings (tests / diagnostics).
   */
  size(): number {
    return this.bySocket.size;
  }
}
