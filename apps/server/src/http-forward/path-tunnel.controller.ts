import { All, Controller, Logger, Req, Res } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";

import { parseTunnelPath } from "../tunnel/public-url.js";
import { TunnelManager } from "../tunnel/tunnel.manager.js";
import { PublicRequestForwarder } from "./public-request-forwarder.js";

/**
 * Path-based public tunnel entrypoint for hosts without wildcard TLS.
 *
 * Registers `ALL /tunnel/*` (Fastify/find-my-way form) so nested paths such as
 * `/tunnel/{id}/products` match before the Host-based catch-all. Strips the
 * `/tunnel/{id}` prefix and reuses {@link PublicRequestForwarder}.
 */
@Controller()
export class PathTunnelController {
  private readonly logger = new Logger(PathTunnelController.name);

  /**
   * @param tunnelManager - Tunnel lookup by full id.
   * @param publicForwarder - Shared HTTP forwarding pipeline.
   */
  constructor(
    private readonly tunnelManager: TunnelManager,
    private readonly publicForwarder: PublicRequestForwarder,
  ) {}

  /**
   * Forwards `/tunnel/:tunnelId` and `/tunnel/:tunnelId/...`.
   *
   * @param request - Inbound Fastify request.
   * @param reply - Fastify reply used for streaming the CLI response.
   */
  @All("tunnel/*")
  async forward(@Req() request: FastifyRequest, @Res() reply: FastifyReply): Promise<void> {
    const pathname = (request.raw.url ?? request.url).split("?")[0] ?? "/";
    const parsed = parseTunnelPath(pathname);

    if (parsed === undefined) {
      await reply.status(404).send({ statusCode: 404, message: "Invalid tunnel path." });
      return;
    }

    const tunnel = this.tunnelManager.lookup(parsed.tunnelId);
    if (tunnel === undefined) {
      this.logger.debug(`Path tunnel not found: ${parsed.tunnelId}`);
      await reply.status(404).send({ statusCode: 404, message: "Tunnel not found." });
      return;
    }

    await this.publicForwarder.forward(tunnel, request, reply, {
      localPath: parsed.localPath,
    });
  }
}
