import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { assertCsrfIfCookieAuth } from "../auth/auth-cookies.js";

/**
 * Enforces CSRF double-submit for cookie-authenticated mutating /api/* calls.
 * Bearer Authorization requests are exempt (CLI + explicit SPA tokens).
 */
export function registerCsrfProtection(fastify: FastifyInstance): void {
  fastify.addHook("onRequest", async (request: FastifyRequest, reply: FastifyReply) => {
    const path = request.url.split("?")[0] ?? "/";
    if (!path.startsWith("/api/")) {
      return;
    }

    try {
      assertCsrfIfCookieAuth(request);
    } catch {
      return reply.code(403).send({
        statusCode: 403,
        error: "Forbidden",
        message: "CSRF token missing or invalid.",
      });
    }
  });
}
