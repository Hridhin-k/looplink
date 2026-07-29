import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { OriginValidator } from "./origin-validator.js";

const CORS_METHODS = "GET, HEAD, PUT, PATCH, POST, DELETE, OPTIONS";
const CORS_HEADERS = "Content-Type, Accept, Authorization";
const CORS_MAX_AGE = "86400";

/**
 * Adds browser CORS headers for `/api/*` only.
 *
 * Uses a Fastify hook instead of `@fastify/cors` because that plugin registers
 * a global `OPTIONS /*` route that collides with the tunnel catch-all.
 *
 * Empty {@link allowedOrigins} → reflect any request `Origin` (local-first /
 * permissive mode, matching {@link OriginValidator}).
 */
export function registerApiCors(fastify: FastifyInstance, allowedOrigins: readonly string[]): void {
  const origins = new OriginValidator(allowedOrigins);

  fastify.addHook("onRequest", async (request, reply) => {
    const path = requestPath(request);
    if (!path.startsWith("/api/")) {
      return;
    }

    applyCorsHeaders(request, reply, origins);

    if (request.method === "OPTIONS") {
      return reply.code(204).send();
    }
  });
}

function requestPath(request: FastifyRequest): string {
  return request.url.split("?")[0] ?? "/";
}

function applyCorsHeaders(
  request: FastifyRequest,
  reply: FastifyReply,
  origins: OriginValidator,
): void {
  const originHeader = request.headers.origin;
  if (typeof originHeader !== "string" || originHeader.trim().length === 0) {
    return;
  }

  if (!origins.isOriginAllowed(originHeader)) {
    return;
  }

  void reply.header("Access-Control-Allow-Origin", originHeader);
  void reply.header("Vary", "Origin");
  void reply.header("Access-Control-Allow-Methods", CORS_METHODS);
  void reply.header("Access-Control-Allow-Headers", CORS_HEADERS);
  void reply.header("Access-Control-Max-Age", CORS_MAX_AGE);
}
