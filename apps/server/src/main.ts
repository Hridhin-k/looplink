import "reflect-metadata";

import { NestFactory } from "@nestjs/core";
import { FastifyAdapter, type NestFastifyApplication } from "@nestjs/platform-fastify";
import { WsAdapter } from "@nestjs/platform-ws";

import { AppModule } from "./app.module.js";
import { resolveServerHost, resolveServerPort } from "./config/server.config.js";

/**
 * Boots the NestJS application on Fastify with native WebSocket support.
 */
async function bootstrap(): Promise<void> {
  const app = await NestFactory.create<NestFastifyApplication>(AppModule, new FastifyAdapter());

  const fastify = app.getHttpAdapter().getInstance();
  fastify.removeAllContentTypeParsers();
  fastify.addContentTypeParser("*", { parseAs: "buffer" }, (_request, body, done) => {
    done(null, body);
  });

  app.useWebSocketAdapter(new WsAdapter(app));

  const host = resolveServerHost();
  const port = resolveServerPort();

  await app.listen(port, host);
}

await bootstrap();
