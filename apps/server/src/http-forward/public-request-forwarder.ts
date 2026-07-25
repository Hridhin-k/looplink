import { Readable } from "node:stream";

import { Injectable, Logger } from "@nestjs/common";
import type { FastifyReply, FastifyRequest } from "fastify";

import type { TunnelRecord } from "../tunnel/tunnel.types.js";
import { HttpForwardingService } from "./http-forwarding.service.js";
import { mapFastifyRequest } from "./request-mapper.js";

/**
 * Options for {@link PublicRequestForwarder.forward}.
 */
export interface PublicForwardOptions {
  /**
   * Path the local application should receive.
   *
   * When omitted, the inbound request path is forwarded unchanged (Host-based
   * routing). Path-based routing supplies a rewritten path with the
   * `/tunnel/{id}` prefix removed.
   */
  readonly localPath?: string;
}

/**
 * Shared HTTP data-plane entry used by Host-based and path-based controllers.
 *
 * Controllers resolve the target {@link TunnelRecord}; this service maps the
 * Fastify request, invokes {@link HttpForwardingService}, and streams the
 * response. Forwarding logic lives in one place.
 */
@Injectable()
export class PublicRequestForwarder {
  private readonly logger = new Logger(PublicRequestForwarder.name);

  /**
   * @param httpForwarding - Protocol forwarding over the tunnel WebSocket.
   */
  constructor(private readonly httpForwarding: HttpForwardingService) {}

  /**
   * Forwards an inbound public HTTP request through a tunnel to the CLI.
   *
   * @param tunnel - Active tunnel session.
   * @param request - Inbound Fastify request.
   * @param reply - Fastify reply used for streaming the CLI response.
   * @param options - Optional local path rewrite.
   */
  async forward(
    tunnel: TunnelRecord,
    request: FastifyRequest,
    reply: FastifyReply,
    options: PublicForwardOptions = {},
  ): Promise<void> {
    let mapped;
    try {
      mapped = mapFastifyRequest(request);
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Invalid request.";
      const statusCode = message.startsWith("Unsupported HTTP method") ? 405 : 400;
      await reply.status(statusCode).send({ statusCode, message });
      return;
    }

    const path = options.localPath ?? mapped.path;

    try {
      const forwarded = await this.httpForwarding.forward({
        tunnel,
        method: mapped.method,
        path,
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
      this.logger.warn(`HTTP forward failed for tunnel ${tunnel.id}: ${message}`);

      if (reply.sent) {
        return;
      }

      const status = message.includes("timed out") || message.includes("aborted") ? 504 : 502;
      await reply.status(status).send({ statusCode: status, message });
    }
  }
}
