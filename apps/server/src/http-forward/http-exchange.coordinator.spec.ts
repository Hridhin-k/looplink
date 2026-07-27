import { MessageType } from "@badger/shared";
import { describe, expect, it } from "vitest";

import { encodeBodyChunk } from "./body-codec.js";
import { HttpExchangeCoordinator } from "./http-exchange.coordinator.js";

describe("HttpExchangeCoordinator", () => {
  it("resolves response start and streams body chunks until end", async () => {
    const coordinator = new HttpExchangeCoordinator();
    const exchange = coordinator.begin("req-1");

    const startPromise = exchange.waitForStart();

    expect(
      coordinator.deliver({
        type: MessageType.HttpResponseStart,
        requestId: "req-1",
        tunnelId: "tun-1",
        statusCode: 200,
        headers: { "content-type": "text/plain" },
        setCookies: ["a=1"],
        hasBody: true,
      }),
    ).toBe(true);

    const start = await startPromise;
    expect(start.statusCode).toBe(200);
    expect(start.setCookies).toEqual(["a=1"]);

    const chunksPromise = (async () => {
      const collected: string[] = [];
      for await (const chunk of exchange.body) {
        collected.push(Buffer.from(chunk).toString("utf8"));
      }
      return collected;
    })();

    const encoded = encodeBodyChunk(Buffer.from("hello"));
    coordinator.deliver({
      type: MessageType.HttpResponseChunk,
      requestId: "req-1",
      tunnelId: "tun-1",
      sequence: 0,
      encoding: encoded.encoding,
      data: encoded.data,
    });
    coordinator.deliver({
      type: MessageType.HttpResponseEnd,
      requestId: "req-1",
      tunnelId: "tun-1",
    });

    await expect(chunksPromise).resolves.toEqual(["hello"]);
  });

  it("fails the exchange when a correlated error arrives", async () => {
    const coordinator = new HttpExchangeCoordinator();
    const exchange = coordinator.begin("req-2");

    const startPromise = exchange.waitForStart();

    coordinator.deliver({
      type: MessageType.Error,
      requestId: "req-2",
      code: "upstream_failed",
      message: "boom",
    });

    await expect(startPromise).rejects.toThrow("boom");
  });

  it("fails the exchange on cancel", async () => {
    const coordinator = new HttpExchangeCoordinator();
    const exchange = coordinator.begin("req-3");
    const startPromise = exchange.waitForStart();

    coordinator.deliver({
      type: MessageType.HttpCancel,
      requestId: "req-3",
      tunnelId: "tun-1",
      reason: "client gone",
    });

    await expect(startPromise).rejects.toThrow("client gone");
  });
});
