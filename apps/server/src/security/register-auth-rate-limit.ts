import {
  AUTH_RATE_LIMIT_MAX,
  AUTH_RATE_LIMIT_WINDOW_MS,
} from "@hridhin-k/badger-shared";
import type { FastifyReply, FastifyRequest } from "fastify";

import { SlidingWindowRateLimiter } from "../security/sliding-window-rate-limiter.js";

const AUTH_PATH_PREFIXES = [
  "/api/v1/auth/login",
  "/api/v1/auth/refresh",
  "/api/v1/auth/oauth/",
  "/api/v1/auth/password/",
  "/api/v1/auth/email/",
  "/api/v1/auth/signup",
];

/**
 * Strict per-IP rate limit for authentication endpoints.
 */
export function createAuthRateLimitHook(): (
  request: FastifyRequest,
  reply: FastifyReply,
) => Promise<void> {
  const max = readPositiveInt("BADGER_AUTH_RATE_LIMIT_MAX", AUTH_RATE_LIMIT_MAX);
  const windowMs = readPositiveInt("BADGER_AUTH_RATE_LIMIT_WINDOW_MS", AUTH_RATE_LIMIT_WINDOW_MS);
  const limiter = new SlidingWindowRateLimiter(max, windowMs);

  return async (request, reply) => {
    const path = (request.url.split("?")[0] ?? "/").toLowerCase();
    if (!AUTH_PATH_PREFIXES.some((prefix) => path.startsWith(prefix))) {
      return;
    }

    const ip = request.ip || "unknown";
    const decision = limiter.attempt(`auth:${ip}`);
    if (!decision.allowed) {
      return reply.code(429).send({
        statusCode: 429,
        error: "Too Many Requests",
        message: "Authentication rate limit exceeded. Try again shortly.",
      });
    }
  };
}

function readPositiveInt(name: string, fallback: number): number {
  const raw = process.env[name];
  if (raw === undefined || raw.trim().length === 0) {
    return fallback;
  }
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 1) {
    return fallback;
  }
  return value;
}
