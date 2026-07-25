import type { FastifyInstance } from "fastify";
import rateLimit from "@fastify/rate-limit";

import type { SecurityConfig } from "./security.config.js";

/**
 * Registers Fastify-native rate limiting for the public HTTP data plane.
 *
 * Health checks are exempt so orchestrators are never throttled.
 *
 * @param fastify - Nest's underlying Fastify instance.
 * @param config - Resolved security limits.
 */
export async function registerHttpRateLimit(
  fastify: FastifyInstance,
  config: SecurityConfig,
): Promise<void> {
  await fastify.register(rateLimit, {
    max: config.httpRateLimitMax,
    timeWindow: config.httpRateLimitWindowMs,
    hook: "onRequest",
    allowList: (request) => {
      const path = request.url.split("?")[0] ?? "/";
      return path === "/health";
    },
    errorResponseBuilder: (_request, context) => ({
      statusCode: 429,
      error: "Too Many Requests",
      message: `Rate limit exceeded. Retry after ${context.after}.`,
    }),
  });
}
