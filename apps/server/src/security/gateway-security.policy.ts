import type { IncomingMessage } from "node:http";

import { Injectable } from "@nestjs/common";
import type WebSocket from "ws";

import { ConnectionLimiter } from "./connection-limiter.js";
import { OriginValidator } from "./origin-validator.js";
import type { SecurityConfig } from "./security.config.js";
import { SlidingWindowRateLimiter } from "./sliding-window-rate-limiter.js";

/**
 * Why a WebSocket connection or message was rejected.
 */
export type GatewayRejectReason = "origin" | "global_limit" | "ip_limit" | "rate_limit";

/**
 * Central policy for WebSocket admission, origin checks, and message rates.
 *
 * Nest's `ws` adapter does not run HTTP middleware or guards on the upgrade
 * path, so the gateway calls this service explicitly from connection and
 * message handlers.
 */
@Injectable()
export class GatewaySecurityPolicy {
  private readonly connections: ConnectionLimiter;
  private readonly messageRates: SlidingWindowRateLimiter;
  private readonly ipByClient = new Map<WebSocket, string>();

  /**
   * @param config - Resolved security limits.
   * @param origins - Origin allow-list validator.
   */
  constructor(
    private readonly config: SecurityConfig,
    private readonly origins: OriginValidator,
  ) {
    this.connections = new ConnectionLimiter(config.maxWsConnections, config.maxWsConnectionsPerIp);
    this.messageRates = new SlidingWindowRateLimiter(
      config.wsMessageRateLimit,
      config.wsMessageRateWindowMs,
    );
  }

  /**
   * @returns WebSocket `maxPayload` in bytes.
   */
  maxPayloadBytes(): number {
    return this.config.maxWsMessageBytes;
  }

  /**
   * Validates origin and reserves a connection slot.
   *
   * @param client - Newly accepted socket.
   * @param request - Upgrade HTTP request.
   * @returns Rejection reason, or `undefined` when admitted.
   */
  admit(client: WebSocket, request: IncomingMessage): GatewayRejectReason | undefined {
    const origin = headerValue(request.headers.origin);
    if (!this.origins.isOriginAllowed(origin)) {
      return "origin";
    }

    const ip = clientIp(request);
    const admitted = this.connections.tryAdmit(ip);
    if (!admitted.ok) {
      return admitted.reason;
    }

    this.ipByClient.set(client, ip);
    return undefined;
  }

  /**
   * Releases the connection slot and rate-limit state for a socket.
   *
   * @param client - Disconnecting socket.
   */
  release(client: WebSocket): void {
    const ip = this.ipByClient.get(client);
    if (ip !== undefined) {
      this.connections.release(ip);
      this.messageRates.reset(ip);
      this.ipByClient.delete(client);
    }
  }

  /**
   * Applies the per-IP message rate limit.
   *
   * @param client - Sending socket.
   * @returns `true` when the message may be processed.
   */
  allowMessage(client: WebSocket): boolean {
    const ip = this.ipByClient.get(client) ?? "unknown";
    return this.messageRates.attempt(ip).allowed;
  }

  /**
   * @returns Live admitted connection count (tests / metrics).
   */
  activeConnections(): number {
    return this.connections.size;
  }
}

/**
 * Extracts a client IP from the upgrade request.
 *
 * Prefers the first `X-Forwarded-For` hop when present (TLS-terminating proxy),
 * otherwise uses the socket remote address.
 *
 * @param request - Upgrade request.
 * @returns Normalized IP string.
 */
export function clientIp(request: IncomingMessage): string {
  const forwarded = headerValue(request.headers["x-forwarded-for"]);
  if (forwarded !== undefined) {
    const first = forwarded.split(",")[0]?.trim();
    if (first !== undefined && first.length > 0) {
      return first;
    }
  }

  return request.socket.remoteAddress ?? "unknown";
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return Array.isArray(value) ? value[0] : value;
}
