import type { Server } from "node:http";

import express from "express";

/** Deterministic binary payload; large enough to span multiple WS body chunks. */
export const BINARY_FIXTURE: Buffer = Buffer.from(
  Uint8Array.from({ length: 150_000 }, (_, index) => (index * 31 + 7) % 256),
);

/** Chunks written by `/stream` with a delay between each write. */
export const STREAM_CHUNKS: readonly string[] = [
  "stream-chunk-0;",
  "stream-chunk-1;",
  "stream-chunk-2;",
  "stream-chunk-3;",
  "stream-chunk-4;",
];

/** JSON document served by `/api/data`. */
export const JSON_FIXTURE = {
  service: "sample-app",
  numbers: [1, 2, 3],
  nested: { enabled: true, label: "loop" },
} as const;

/** HTML document served by `/`. */
export const HTML_FIXTURE = [
  "<!doctype html>",
  "<html>",
  "<head><title>LoopLink sample app</title></head>",
  "<body><h1>Hello from behind the tunnel</h1></body>",
  "</html>",
].join("\n");

/**
 * A running sample application.
 */
export interface RunningSampleApp {
  /** Port the app is actually listening on. */
  readonly port: number;
  /** Closes the HTTP server. */
  close(): Promise<void>;
}

/**
 * Starts the sample Express app used as the tunnel's local target.
 *
 * Prefers the conventional port 3000 and falls back to an ephemeral port when
 * 3000 is already taken, so the suite can run alongside a dev server.
 *
 * @param preferredPort - Port to try first.
 * @returns Handle with the bound port and a close function.
 */
export async function startSampleApp(preferredPort = 3000): Promise<RunningSampleApp> {
  const app = buildApp();

  let server: Server;
  try {
    server = await listen(app, preferredPort);
  } catch (error: unknown) {
    if (!isAddressInUse(error)) {
      throw error;
    }
    server = await listen(app, 0);
  }

  const address = server.address();
  if (address === null || typeof address === "string") {
    throw new Error("Sample app did not report a TCP address.");
  }

  return {
    port: address.port,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((error) => {
          if (error === undefined) {
            resolve();
          } else {
            reject(error);
          }
        });
      }),
  };
}

function buildApp(): express.Express {
  const app = express();

  app.get("/", (_request, response) => {
    response.type("text/html").send(HTML_FIXTURE);
  });

  app.get("/api/data", (_request, response) => {
    response.json(JSON_FIXTURE);
  });

  app.get("/headers", (request, response) => {
    response.setHeader("x-sample-response", "header-check");
    response.json({
      received: request.header("x-sample-request") ?? null,
      accept: request.header("accept") ?? null,
    });
  });

  app.get("/cookies", (request, response) => {
    response.cookie("session", "abc123", { httpOnly: true, path: "/" });
    response.cookie("theme", "dark", { path: "/" });
    response.json({ cookieHeader: request.headers.cookie ?? null });
  });

  app.get("/binary", (_request, response) => {
    response.type("application/octet-stream").send(BINARY_FIXTURE);
  });

  app.get("/stream", (_request, response) => {
    response.type("text/plain");

    let index = 0;
    const timer = setInterval(() => {
      const chunk = STREAM_CHUNKS[index];

      if (chunk === undefined) {
        clearInterval(timer);
        response.end();
        return;
      }

      response.write(chunk);
      index += 1;
    }, 25);
  });

  app.post("/echo", express.raw({ type: "*/*", limit: "5mb" }), (request, response) => {
    const body: unknown = request.body;
    const buffer = Buffer.isBuffer(body) ? body : Buffer.alloc(0);

    response.json({
      contentType: request.header("content-type") ?? null,
      bytes: buffer.byteLength,
      text: buffer.toString("utf8"),
    });
  });

  return app;
}

function listen(app: express.Express, port: number): Promise<Server> {
  return new Promise((resolve, reject) => {
    const server = app.listen(port, "127.0.0.1");
    server.once("listening", () => {
      resolve(server);
    });
    server.once("error", reject);
  });
}

function isAddressInUse(error: unknown): boolean {
  return error instanceof Error && (error as NodeJS.ErrnoException).code === "EADDRINUSE";
}
