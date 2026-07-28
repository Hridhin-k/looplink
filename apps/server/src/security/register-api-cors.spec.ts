import Fastify from "fastify";
import { afterEach, describe, expect, it } from "vitest";

import { registerApiCors } from "./register-api-cors.js";

describe("registerApiCors", () => {
  const apps: ReturnType<typeof Fastify>[] = [];

  afterEach(async () => {
    await Promise.all(apps.splice(0).map((app) => app.close()));
  });

  it("reflects Origin on /api routes when the allow-list is empty", async () => {
    const app = Fastify();
    apps.push(app);
    registerApiCors(app, []);
    app.get("/api/v1/inspector/requests", async () => ({ items: [] }));

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/inspector/requests",
      headers: { origin: "http://localhost:3000" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(response.headers.vary).toBe("Origin");
  });

  it("answers OPTIONS preflight for /api routes", async () => {
    const app = Fastify();
    apps.push(app);
    registerApiCors(app, []);

    const response = await app.inject({
      method: "OPTIONS",
      url: "/api/v1/inspector/requests",
      headers: {
        origin: "http://localhost:3000",
        "access-control-request-method": "GET",
      },
    });

    expect(response.statusCode).toBe(204);
    expect(response.headers["access-control-allow-origin"]).toBe("http://localhost:3000");
    expect(response.headers["access-control-allow-methods"]).toContain("GET");
  });

  it("does not add CORS headers on non-api routes", async () => {
    const app = Fastify();
    apps.push(app);
    registerApiCors(app, []);
    app.get("/tunnel/abc", async () => "ok");

    const response = await app.inject({
      method: "GET",
      url: "/tunnel/abc",
      headers: { origin: "http://localhost:3000" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });

  it("omits CORS headers for disallowed Origins", async () => {
    const app = Fastify();
    apps.push(app);
    registerApiCors(app, ["http://localhost:3000"]);
    app.get("/api/v1/inspector/requests", async () => ({ items: [] }));

    const response = await app.inject({
      method: "GET",
      url: "/api/v1/inspector/requests",
      headers: { origin: "https://evil.example" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["access-control-allow-origin"]).toBeUndefined();
  });
});
