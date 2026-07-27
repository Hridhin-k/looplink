import {
  HTTP_RATE_LIMIT_MAX,
  HTTP_RATE_LIMIT_WINDOW_MS,
  HTTP_REQUEST_TIMEOUT_MS,
  MAX_HTTP_BODY_BYTES,
  MAX_WS_CONNECTIONS,
  MAX_WS_CONNECTIONS_PER_IP,
  MAX_WS_MESSAGE_BYTES,
  WS_MESSAGE_RATE_LIMIT,
  WS_MESSAGE_RATE_WINDOW_MS,
} from "@badger/shared";

import { parseAllowedOrigins } from "./origin-validator.js";

/**
 * Resolved security limits for the Badger server process.
 */
export interface SecurityConfig {
  /** Fastify bodyLimit / public request body cap. */
  readonly maxHttpBodyBytes: number;
  /** `ws` maxPayload for CLI frames. */
  readonly maxWsMessageBytes: number;
  /** Global WebSocket connection ceiling. */
  readonly maxWsConnections: number;
  /** Per-IP WebSocket connection ceiling. */
  readonly maxWsConnectionsPerIp: number;
  /** CLI protocol messages allowed per window. */
  readonly wsMessageRateLimit: number;
  /** Window for {@link wsMessageRateLimit}. */
  readonly wsMessageRateWindowMs: number;
  /** Public HTTP requests allowed per IP per window. */
  readonly httpRateLimitMax: number;
  /** Window for {@link httpRateLimitMax}. */
  readonly httpRateLimitWindowMs: number;
  /** Fastify request timeout (headers + body). */
  readonly httpRequestTimeoutMs: number;
  /** Allowed browser Origins; empty means permissive. */
  readonly allowedOrigins: readonly string[];
}

/**
 * Reads an optional positive integer from the environment.
 *
 * @param name - Env var name.
 * @param fallback - Default when unset or empty.
 * @returns Parsed integer.
 */
function readPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim().length === 0) {
    return fallback;
  }

  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    throw new Error(`Invalid ${name} "${raw}": expected a positive integer.`);
  }

  return value;
}

/**
 * Resolves security limits from the process environment.
 *
 * @returns Immutable configuration snapshot.
 */
export function resolveSecurityConfig(): SecurityConfig {
  return {
    maxHttpBodyBytes: readPositiveInt("BADGER_MAX_HTTP_BODY_BYTES", MAX_HTTP_BODY_BYTES),
    maxWsMessageBytes: readPositiveInt("BADGER_MAX_WS_MESSAGE_BYTES", MAX_WS_MESSAGE_BYTES),
    maxWsConnections: readPositiveInt("BADGER_MAX_WS_CONNECTIONS", MAX_WS_CONNECTIONS),
    maxWsConnectionsPerIp: readPositiveInt(
      "BADGER_MAX_WS_CONNECTIONS_PER_IP",
      MAX_WS_CONNECTIONS_PER_IP,
    ),
    wsMessageRateLimit: readPositiveInt("BADGER_WS_MESSAGE_RATE_LIMIT", WS_MESSAGE_RATE_LIMIT),
    wsMessageRateWindowMs: readPositiveInt(
      "BADGER_WS_MESSAGE_RATE_WINDOW_MS",
      WS_MESSAGE_RATE_WINDOW_MS,
    ),
    httpRateLimitMax: readPositiveInt("BADGER_HTTP_RATE_LIMIT_MAX", HTTP_RATE_LIMIT_MAX),
    httpRateLimitWindowMs: readPositiveInt(
      "BADGER_HTTP_RATE_LIMIT_WINDOW_MS",
      HTTP_RATE_LIMIT_WINDOW_MS,
    ),
    httpRequestTimeoutMs: readPositiveInt(
      "BADGER_HTTP_REQUEST_TIMEOUT_MS",
      HTTP_REQUEST_TIMEOUT_MS,
    ),
    allowedOrigins: parseAllowedOrigins(process.env["BADGER_ALLOWED_ORIGINS"]),
  };
}
