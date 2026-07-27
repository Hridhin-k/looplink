import { HttpMethod } from "@badger/shared";
import { MockAgent, type MockPool } from "undici";
import { afterEach, describe, expect, it } from "vitest";

import {
  LocalProxy,
  buildLocalUrl,
  buildRequestHeaders,
  splitResponseHeaders,
} from "./local-proxy.js";

describe("buildLocalUrl", () => {
  it("builds a localhost URL with path and query", () => {
    expect(
      buildLocalUrl("127.0.0.1", 3000, "/api/users", {
        q: "a",
        tag: ["x", "y"],
      }),
    ).toBe("http://127.0.0.1:3000/api/users?q=a&tag=x&tag=y");
  });

  it("normalizes paths that omit a leading slash", () => {
    expect(buildLocalUrl("127.0.0.1", 3000, "health", {})).toBe("http://127.0.0.1:3000/health");
  });
});

describe("buildRequestHeaders", () => {
  it("sets Host, serializes cookies, and strips hop-by-hop headers", () => {
    const headers = buildRequestHeaders(
      {
        Accept: "application/json",
        Connection: "keep-alive",
        Cookie: "ignored=1",
        "X-Request-Id": "abc",
      },
      { session: "s1", theme: "dark" },
      "127.0.0.1",
      3000,
    );

    expect(headers["host"]).toBe("127.0.0.1:3000");
    expect(headers["Accept"]).toBe("application/json");
    expect(headers["X-Request-Id"]).toBe("abc");
    expect(headers["cookie"]).toBe("session=s1; theme=dark");
    expect(headers["Connection"]).toBeUndefined();
    expect(headers["Cookie"]).toBeUndefined();
  });
});

describe("splitResponseHeaders", () => {
  it("extracts set-cookie values into a dedicated list", () => {
    const split = splitResponseHeaders({
      "content-type": "text/plain",
      "set-cookie": ["a=1; Path=/", "b=2; HttpOnly"],
      "x-extra": "1",
    });

    expect(split.headers).toEqual({
      "content-type": "text/plain",
      "x-extra": "1",
    });
    expect(split.setCookies).toEqual(["a=1; Path=/", "b=2; HttpOnly"]);
  });
});

describe("LocalProxy", () => {
  let mockAgent: MockAgent;
  let pool: MockPool;

  afterEach(async () => {
    await mockAgent.close();
  });

  function createProxy(): LocalProxy {
    mockAgent = new MockAgent();
    mockAgent.disableNetConnect();
    pool = mockAgent.get("http://127.0.0.1:3000");
    return new LocalProxy({ dispatcher: mockAgent });
  }

  it("forwards a GET request and returns status, headers, and body", async () => {
    const proxy = createProxy();

    pool
      .intercept({
        path: "/hello?lang=en",
        method: "GET",
        headers: {
          host: "127.0.0.1:3000",
          accept: "text/plain",
          cookie: "sid=abc",
        },
      })
      .reply(200, "hello world", {
        headers: {
          "content-type": "text/plain",
          "set-cookie": "sid=abc; Path=/",
          "x-local": "1",
        },
      });

    const response = await proxy.forward(3000, {
      method: HttpMethod.GET,
      path: "/hello",
      query: { lang: "en" },
      headers: { Accept: "text/plain" },
      cookies: { sid: "abc" },
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["content-type"]).toBe("text/plain");
    expect(response.headers["x-local"]).toBe("1");
    expect(response.setCookies).toEqual(["sid=abc; Path=/"]);
    expect(await readBodyText(response.body)).toBe("hello world");
  });

  it("forwards a POST body and streams a chunked response", async () => {
    const proxy = createProxy();

    pool.intercept({ path: "/echo", method: "POST" }).reply(201, Buffer.from("chunk-1 chunk-2"), {
      headers: {
        "content-type": "application/octet-stream",
      },
    });

    const response = await proxy.forward(3000, {
      method: HttpMethod.POST,
      path: "/echo",
      query: {},
      headers: { "content-type": "text/plain" },
      cookies: {},
      body: "ping",
    });

    expect(response.statusCode).toBe(201);

    const chunks: string[] = [];
    for await (const chunk of response.body) {
      chunks.push(Buffer.from(chunk).toString("utf8"));
    }

    expect(chunks.join("")).toBe("chunk-1 chunk-2");
    expect(chunks.length).toBeGreaterThan(0);
  });

  it("forwards a streaming request body", async () => {
    const proxy = createProxy();

    pool.intercept({ path: "/upload", method: "PUT" }).reply(204, Buffer.alloc(0));

    async function* body(): AsyncIterable<Uint8Array> {
      yield new TextEncoder().encode("a");
      yield new TextEncoder().encode("b");
    }

    const response = await proxy.forward(3000, {
      method: HttpMethod.PUT,
      path: "/upload",
      query: {},
      headers: {},
      cookies: {},
      body: body(),
    });

    expect(response.statusCode).toBe(204);
    expect(await readBodyText(response.body)).toBe("");
  });

  it("aborts the local request when the signal is aborted", async () => {
    const proxy = createProxy();
    const controller = new AbortController();

    pool
      .intercept({
        path: "/slow",
        method: "GET",
      })
      .reply(200, "too late")
      .delay(1_000);

    controller.abort();

    await expect(
      proxy.forward(3000, {
        method: HttpMethod.GET,
        path: "/slow",
        query: {},
        headers: {},
        cookies: {},
        signal: controller.signal,
      }),
    ).rejects.toThrow();
  });

  it("supports PATCH and DELETE methods", async () => {
    const proxy = createProxy();

    pool.intercept({ path: "/item/1", method: "PATCH" }).reply(200, "patched");
    pool.intercept({ path: "/item/1", method: "DELETE" }).reply(204, Buffer.alloc(0));

    const patched = await proxy.forward(3000, {
      method: HttpMethod.PATCH,
      path: "/item/1",
      query: {},
      headers: { "content-type": "application/json" },
      cookies: {},
      body: '{"a":1}',
    });
    expect(patched.statusCode).toBe(200);
    expect(await readBodyText(patched.body)).toBe("patched");

    const deleted = await proxy.forward(3000, {
      method: HttpMethod.DELETE,
      path: "/item/1",
      query: {},
      headers: {},
      cookies: {},
    });
    expect(deleted.statusCode).toBe(204);
  });
});

/**
 * Collects a streamed body into a UTF-8 string.
 *
 * @param body - Streaming response body.
 * @returns Decoded text.
 */
async function readBodyText(body: AsyncIterable<Uint8Array>): Promise<string> {
  const chunks: Buffer[] = [];

  for await (const chunk of body) {
    chunks.push(Buffer.from(chunk));
  }

  return Buffer.concat(chunks).toString("utf8");
}
