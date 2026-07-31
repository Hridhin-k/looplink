import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { WsAdapter } from "@nestjs/platform-ws";
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger";

import { AppModule } from "./app.module.js";
import { loadLocalEnv } from "./config/load-local-env.js";
import { resolveServerHost, resolveServerPort } from "./config/server.config.js";
import { StructuredLogger } from "./observability/structured-logger.js";
import { isAuthCookieEnabled } from "./auth/auth-cookies.js";
import { registerApiCors } from "./security/register-api-cors.js";
import { createAuthRateLimitHook } from "./security/register-auth-rate-limit.js";
import { registerCsrfProtection } from "./security/register-csrf.js";
import { registerHttpRateLimit } from "./security/register-http-rate-limit.js";
import { resolveSecurityConfig } from "./security/security.config.js";

// Local `.env.local` / `.env` before any config resolution (shell env still wins).
loadLocalEnv();

/**
 * Boots the NestJS application on Fastify with native WebSocket support.
 */
async function bootstrap(): Promise<void> {
  const security = resolveSecurityConfig();
  const bootLogger = new StructuredLogger();

  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({
      // Reject oversized public request bodies before they hit the forwarder.
      bodyLimit: security.maxHttpBodyBytes,
      // Abort slow clients that stall during headers/body upload.
      requestTimeout: security.httpRequestTimeoutMs,
      // Bound how long we wait for the request line / headers.
      connectionTimeout: security.httpRequestTimeoutMs,
    }),
    { bufferLogs: true },
  );

  const fastify = app.getHttpAdapter().getInstance();
  // Dashboard browsers call /api/v1/* cross-origin; tunnel CLI does not.
  // Scoped to /api/* so we do not open CORS on the public tunnel data plane.
  registerApiCors(fastify, security.allowedOrigins);
  // Fail fast if cookie mode is enabled without an explicit origin allow-list.
  isAuthCookieEnabled();
  registerCsrfProtection(fastify);
  await registerHttpRateLimit(fastify, security);
  fastify.addHook("onRequest", createAuthRateLimitHook());

  app.useWebSocketAdapter(new WsAdapter(app));

  const swaggerConfig = new DocumentBuilder()
    .setTitle("Badger API")
    .setDescription(
      "Inspector, statistics, replay, and authentication. Inspector remains public; auth endpoints use Bearer JWTs.",
    )
    .setVersion("1.0")
    .addBearerAuth()
    .addTag("inspector")
    .addTag("auth")
    .build();
  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup("api/docs", app, document);

  // Nest's Fastify adapter registers its own JSON/urlencoded parsers during
  // init, so the raw-buffer catch-all must be installed afterwards. The data
  // plane needs untouched bytes for every content type: bodies are forwarded
  // verbatim to the tunnel client, never interpreted here.
  await app.init();
  fastify.removeAllContentTypeParsers();
  fastify.addContentTypeParser("*", { parseAs: "buffer" }, (_request, body, done) => {
    done(null, body);
  });

  const host = resolveServerHost();
  const port = resolveServerPort();

  await app.listen(port, host);
  bootLogger.log("server.started", { host, port });
}

await bootstrap();
