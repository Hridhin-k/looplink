import { Injectable, type NestMiddleware } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";

import { resolvePublicBaseDomain } from "../tunnel/public-url.js";
import { OriginValidator } from "./origin-validator.js";

/**
 * Rejects browser requests whose `Origin` is not allow-listed.
 *
 * Applied to the public HTTP data plane. The Badger CLI does not send
 * `Origin`, so those requests pass. Tunnel Host headers must still match the
 * configured public base domain (or the allow-list in permissive setups).
 */
@Injectable()
export class OriginMiddleware implements NestMiddleware {
  private readonly baseDomain = resolvePublicBaseDomain();

  /**
   * @param origins - Shared origin policy.
   */
  constructor(private readonly origins: OriginValidator) {}

  /**
   * Fastify-compatible Nest middleware entrypoint.
   *
   * @param request - Inbound request.
   * @param reply - Outbound reply.
   * @param next - Continuation when validation passes.
   */
  use(
    request: FastifyRequest["raw"],
    reply: FastifyReply["raw"],
    next: (error?: Error) => void,
  ): void {
    const originHeader = headerValue(request.headers.origin);
    if (!this.origins.isOriginAllowed(originHeader)) {
      reply.statusCode = 403;
      reply.setHeader("Content-Type", "application/json; charset=utf-8");
      reply.end(JSON.stringify({ statusCode: 403, message: "Origin not allowed." }));
      return;
    }

    const hostHeader = headerValue(request.headers.host);
    if (!this.origins.isHostAllowed(hostHeader, this.baseDomain)) {
      reply.statusCode = 400;
      reply.setHeader("Content-Type", "application/json; charset=utf-8");
      reply.end(JSON.stringify({ statusCode: 400, message: "Invalid Host header." }));
      return;
    }

    next();
  }
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (value === undefined) {
    return undefined;
  }

  return Array.isArray(value) ? value[0] : value;
}
