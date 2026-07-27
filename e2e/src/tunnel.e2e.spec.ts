import { afterAll, beforeAll, describe, expect, it } from "vitest";
import WebSocket from "ws";

import {
  TUNNEL_URL_PATTERN,
  assertWorkspacesBuilt,
  getFreePort,
  startCli,
  startServer,
  tunnelRequest,
  type ManagedProcess,
} from "./support/harness.js";
import {
  BINARY_FIXTURE,
  HTML_FIXTURE,
  JSON_FIXTURE,
  STREAM_CHUNKS,
  startSampleApp,
  type RunningSampleApp,
} from "./support/sample-app.js";

/**
 * Full-stack scenario: the built server and CLI run as real child processes,
 * a sample Express app plays the role of the developer's local service, and
 * every request below travels
 *
 *   test → server (public host) → WebSocket → CLI → Express app → back.
 */
describe("Badger end-to-end", () => {
  let app: RunningSampleApp;
  let server: ManagedProcess;
  let cli: ManagedProcess;
  let serverPort: number;
  let publicUrl: string;

  beforeAll(async () => {
    assertWorkspacesBuilt();

    app = await startSampleApp(3000);
    serverPort = await getFreePort();
    server = await startServer(serverPort);
    cli = startCli(app.port, serverPort);

    publicUrl = await cli.waitFor((output) => output.match(TUNNEL_URL_PATTERN)?.[0]);
  });

  afterAll(async () => {
    await cli?.stop();
    await server?.stop();
    await app?.close();
  });

  it("creates a tunnel and reports the public URL", () => {
    expect(publicUrl).toMatch(/^https:\/\/[a-z0-9]{16}\.badger\.test$/);
    expect(cli.output()).toContain("Tunnel Created");
  });

  it("forwards JSON responses", async () => {
    const response = await tunnelRequest(serverPort, publicUrl, "/api/data");

    expect(response.statusCode).toBe(200);
    expect(String(response.headers["content-type"])).toContain("application/json");
    expect(JSON.parse(response.body.toString("utf8"))).toEqual(JSON_FIXTURE);
  });

  it("forwards HTML responses", async () => {
    const response = await tunnelRequest(serverPort, publicUrl, "/");

    expect(response.statusCode).toBe(200);
    expect(String(response.headers["content-type"])).toContain("text/html");
    expect(response.body.toString("utf8")).toBe(HTML_FIXTURE);
  });

  it("forwards request headers and returns response headers", async () => {
    const response = await tunnelRequest(serverPort, publicUrl, "/headers", {
      headers: {
        "x-sample-request": "hello-tunnel",
        accept: "application/json",
      },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["x-sample-response"]).toBe("header-check");

    const echoed = JSON.parse(response.body.toString("utf8"));
    expect(echoed.received).toBe("hello-tunnel");
    expect(echoed.accept).toBe("application/json");
  });

  it("forwards cookies in both directions", async () => {
    const response = await tunnelRequest(serverPort, publicUrl, "/cookies", {
      headers: { cookie: "user=hridhin; plan=free" },
    });

    expect(response.statusCode).toBe(200);

    const echoed = JSON.parse(response.body.toString("utf8"));
    expect(echoed.cookieHeader).toContain("user=hridhin");
    expect(echoed.cookieHeader).toContain("plan=free");

    const rawSetCookie = response.headers["set-cookie"];
    const setCookies = Array.isArray(rawSetCookie) ? rawSetCookie : [rawSetCookie];
    expect(setCookies).toHaveLength(2);
    expect(setCookies[0]).toContain("session=abc123");
    expect(setCookies[0]).toContain("HttpOnly");
    expect(setCookies[1]).toContain("theme=dark");
  });

  it("forwards request bodies (POST) and query parameters", async () => {
    const payload = JSON.stringify({ message: "ping through the tunnel", id: 42 });

    const response = await tunnelRequest(serverPort, publicUrl, "/echo?trace=e2e", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
    });

    expect(response.statusCode).toBe(200);

    const echoed = JSON.parse(response.body.toString("utf8"));
    expect(echoed.contentType).toBe("application/json");
    expect(echoed.bytes).toBe(Buffer.byteLength(payload));
    expect(echoed.text).toBe(payload);
  });

  it("forwards binary files byte-for-byte", async () => {
    const response = await tunnelRequest(serverPort, publicUrl, "/binary");

    expect(response.statusCode).toBe(200);
    expect(String(response.headers["content-type"])).toContain("application/octet-stream");
    expect(response.body.byteLength).toBe(BINARY_FIXTURE.byteLength);
    expect(response.body.equals(BINARY_FIXTURE)).toBe(true);
  });

  it("forwards streaming (chunked) responses", async () => {
    const response = await tunnelRequest(serverPort, publicUrl, "/stream");

    expect(response.statusCode).toBe(200);
    // The sample app never sets Content-Length for this route, so the whole
    // chain must stream chunked transfer encoding end to end.
    expect(response.headers["content-length"]).toBeUndefined();
    expect(response.body.toString("utf8")).toBe(STREAM_CHUNKS.join(""));
  });

  it("answers protocol heartbeats with a matching pong", async () => {
    const socket = new WebSocket(`ws://127.0.0.1:${serverPort}`);

    try {
      await new Promise<void>((resolve, reject) => {
        socket.once("open", () => resolve());
        socket.once("error", reject);
      });

      const connected = await nextMessage(socket);
      expect(connected.type).toBe("connected");
      expect(typeof connected.connectionId).toBe("string");

      const pongPromise = nextMessage(socket);
      socket.send(JSON.stringify({ type: "ping", requestId: "e2e-heartbeat-1" }));

      const pong = await pongPromise;
      expect(pong).toEqual({ type: "pong", requestId: "e2e-heartbeat-1" });
    } finally {
      socket.close();
    }
  });

  it("reconnects and keeps forwarding after a server restart", async () => {
    const urlsBefore = cli.output().match(TUNNEL_URL_PATTERN) ?? [];

    // SIGKILL simulates an abrupt network interruption / server crash.
    await server.stop("SIGKILL");
    await cli.waitForOutput(/Connection lost/, 15_000);

    server = await startServer(serverPort);

    // The restarted server has an empty tunnel registry, so the CLI's reclaim
    // attempt yields a fresh tunnel; the CLI prints the new public URL.
    const newUrl = await cli.waitFor((output) => {
      const urls = output.match(TUNNEL_URL_PATTERN) ?? [];
      return urls.length > urlsBefore.length ? urls[urls.length - 1] : undefined;
    }, 30_000);

    const response = await tunnelRequest(serverPort, newUrl, "/api/data");
    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body.toString("utf8"))).toEqual(JSON_FIXTURE);
  });
});

function nextMessage(socket: WebSocket): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    socket.once("message", (data) => {
      resolve(JSON.parse(String(data)) as Record<string, unknown>);
    });
    socket.once("error", reject);
  });
}
