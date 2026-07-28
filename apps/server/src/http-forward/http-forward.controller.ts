import { All, Controller, Req, Res } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";

import { extractTunnelSlugFromHost, resolvePublicBaseDomain } from "../tunnel/public-url.js";
import { TunnelManager } from "../tunnel/tunnel.manager.js";
import { PublicRequestForwarder } from "./public-request-forwarder.js";

/**
 * Catch-all HTTP controller that forwards public tunnel traffic by Host header.
 *
 * Path-based `/tunnel/:id` traffic is handled by {@link PathTunnelController};
 * this controller leaves those paths alone so the two schemes can coexist.
 */
@Controller()
export class HttpForwardController {
  private readonly baseDomain = resolvePublicBaseDomain();

  /**
   * @param tunnelManager - Tunnel lookup by public slug.
   * @param publicForwarder - Shared HTTP forwarding pipeline.
   */
  constructor(
    private readonly tunnelManager: TunnelManager,
    private readonly publicForwarder: PublicRequestForwarder,
  ) {}

  /**
   * Forwards any HTTP request addressed to a tunnel subdomain host.
   *
   * @param request - Inbound Fastify request.
   * @param reply - Fastify reply used for streaming the CLI response.
   */
  @All("*")
  async forward(@Req() request: FastifyRequest, @Res() reply: FastifyReply): Promise<void> {
    const path = request.url.split("?")[0] ?? "/";
    if (request.method === "GET" && path === "/health") {
      await reply.status(200).send({ status: "ok" });
      return;
    }

    // Management surfaces live under /api/v1 and /api/docs. Do not treat them as
    // Host-based tunnel traffic — but allow application paths such as /api/data.
    if (isReservedManagementPath(path)) {
      await reply.status(404).send({ statusCode: 404, message: "Not found." });
      return;
    }

    // Path-based tunnels are owned by PathTunnelController. If a request still
    // lands here (for example `/tunnel` with no id), reject rather than treating
    // it as Host-based traffic.
    if (path === "/tunnel" || path.startsWith("/tunnel/")) {
      await reply.status(404).send({ statusCode: 404, message: "Invalid tunnel path." });
      return;
    }

    const hostHeader = request.headers.host;
    if (hostHeader === undefined || hostHeader.length === 0) {
      await reply.status(400).send({ statusCode: 400, message: "Missing Host header." });
      return;
    }

    const slug = extractTunnelSlugFromHost(hostHeader, this.baseDomain);
    if (slug === undefined) {
      await reply.status(404).send({ statusCode: 404, message: "Unknown tunnel host." });
      return;
    }

    const tunnel = this.tunnelManager.lookupBySlug(slug);
    if (tunnel === undefined) {
      await reply.status(404).send({ statusCode: 404, message: "Tunnel not found." });
      return;
    }

    await this.publicForwarder.forward(tunnel, request, reply);
  }
}

/**
 * Returns `true` when `path` is reserved for Badger management HTTP APIs.
 *
 * Application tunnels may expose their own `/api/...` routes; only the
 * versioned inspector surface and Swagger docs are reserved.
 *
 * @param path - Request pathname without query string.
 */
export function isReservedManagementPath(path: string): boolean {
  return (
    path === "/api/v1" ||
    path.startsWith("/api/v1/") ||
    path === "/api/docs" ||
    path.startsWith("/api/docs/")
  );
}
