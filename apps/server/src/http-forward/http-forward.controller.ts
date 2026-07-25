import { Readable } from "node:stream";

import { All, Controller, Logger, Req, Res } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";

import { extractTunnelSlugFromHost, resolvePublicBaseDomain } from "../tunnel/public-url.js";
import { TunnelManager } from "../tunnel/tunnel.manager.js";
import { HttpForwardingService } from "./http-forwarding.service.js";
import { mapFastifyRequest } from "./request-mapper.js";

/**
 * Catch-all HTTP controller that forwards public tunnel traffic to CLI clients.
 */
@Controller()
export class HttpForwardController {
  private readonly logger = new Logger(HttpForwardController.name);
  private readonly baseDomain = resolvePublicBaseDomain();

  /**
   * @param tunnelManager - Tunnel lookup.
   * @param httpForwarding - Protocol forwarding service.
   */
  constructor(
    private readonly tunnelManager: TunnelManager,
    private readonly httpForwarding: HttpForwardingService,
  ) {}

  /**
   * Forwards any HTTP request addressed to a tunnel host.
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

    let mapped;
    try {
      mapped = mapFastifyRequest(request);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Invalid request.";
      await reply.status(405).send({ statusCode: 405, message });
      return;
    }

    try {
      const forwarded = await this.httpForwarding.forward({
        tunnel,
        method: mapped.method,
        path: mapped.path,
        query: mapped.query,
        headers: mapped.headers,
        cookies: mapped.cookies,
        ...(mapped.body === undefined ? {} : { body: mapped.body }),
      });

      for (const [name, value] of Object.entries(forwarded.headers)) {
        void reply.header(name, value);
      }

      for (const cookie of forwarded.setCookies) {
        void reply.header("set-cookie", cookie);
      }

      void reply.status(forwarded.statusCode);

      const stream = Readable.from(
        (async function* () {
          for await (const chunk of forwarded.body) {
            yield Buffer.from(chunk);
          }
        })(),
      );

      await reply.send(stream);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Upstream tunnel error.";
      this.logger.warn(`HTTP forward failed for ${slug}: ${message}`);

      if (reply.sent) {
        return;
      }

      const status = message.includes("timed out") || message.includes("aborted") ? 504 : 502;
      await reply.status(status).send({ statusCode: status, message });
    }
  }
}
