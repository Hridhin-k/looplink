import { afterAll, beforeAll, describe, expect, it } from "vitest";

import {
  PATH_TUNNEL_URL_PATTERN,
  assertWorkspacesBuilt,
  getFreePort,
  joinTunnelRequestPath,
  startCli,
  startServer,
  tunnelRequest,
  type ManagedProcess,
} from "./support/harness.js";
import {
  HTML_FIXTURE,
  JSON_FIXTURE,
  startSampleApp,
  type RunningSampleApp,
} from "./support/sample-app.js";

/**
 * Path-based public URLs (`/tunnel/{id}/...`) for hosts without wildcard TLS
 * (for example Railway's service domain).
 */
describe("Badger path-based tunnel routing", () => {
  let app: RunningSampleApp;
  let server: ManagedProcess;
  let cli: ManagedProcess;
  let serverPort: number;
  let publicUrl: string;
  let tunnelId: string;

  beforeAll(async () => {
    assertWorkspacesBuilt();

    app = await startSampleApp(3000);
    serverPort = await getFreePort();
    server = await startServer(serverPort, { publicUrlMode: "path" });
    cli = startCli(app.port, serverPort);

    publicUrl = await cli.waitFor((output) => output.match(PATH_TUNNEL_URL_PATTERN)?.[0]);
    tunnelId = new URL(publicUrl).pathname.replace(/^\/tunnel\//, "");
  });

  afterAll(async () => {
    await cli?.stop();
    await server?.stop();
    await app?.close();
  });

  it("mints a Railway-compatible path-based public URL", () => {
    expect(publicUrl).toMatch(/^https:\/\/badger\.test\/tunnel\/[a-f0-9]{32}$/);
    expect(cli.output()).toContain("Tunnel Created");
  });

  it("joins application paths under /tunnel/{id}", () => {
    expect(joinTunnelRequestPath(`/tunnel/${tunnelId}`, "/api/data")).toBe(
      `/tunnel/${tunnelId}/api/data`,
    );
    expect(joinTunnelRequestPath(`/tunnel/${tunnelId}`, "/")).toBe(`/tunnel/${tunnelId}`);
    expect(joinTunnelRequestPath(`/tunnel/${tunnelId}`, "/echo?trace=1")).toBe(
      `/tunnel/${tunnelId}/echo?trace=1`,
    );
  });

  it("forwards JSON after stripping the /tunnel/{id} prefix", async () => {
    const response = await tunnelRequest(serverPort, publicUrl, "/api/data");

    expect(response.statusCode).toBe(200);
    expect(JSON.parse(response.body.toString("utf8"))).toEqual(JSON_FIXTURE);
  });

  it("forwards the site root through /tunnel/{id}", async () => {
    const response = await tunnelRequest(serverPort, publicUrl, "/");

    expect(response.statusCode).toBe(200);
    expect(response.body.toString("utf8")).toBe(HTML_FIXTURE);
  });

  it("forwards nested paths and query strings", async () => {
    const payload = JSON.stringify({ via: "path-tunnel" });

    const response = await tunnelRequest(serverPort, publicUrl, "/echo?source=e2e", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
    });

    expect(response.statusCode).toBe(200);
    const echoed = JSON.parse(response.body.toString("utf8"));
    expect(echoed.text).toBe(payload);
  });

  it("returns 404 for unknown tunnel ids", async () => {
    const missing = publicUrl.replace(tunnelId, "0".repeat(32));
    const response = await tunnelRequest(serverPort, missing, "/api/data");

    expect(response.statusCode).toBe(404);
  });
});
