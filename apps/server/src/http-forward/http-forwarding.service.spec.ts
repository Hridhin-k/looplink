import { HttpMethod, MessageType, parseProtocolMessage } from "@badger/shared";
import { describe, expect, it, vi } from "vitest";
import WebSocket from "ws";

import type { TunnelRecord } from "../tunnel/tunnel.types.js";
import { encodeBodyChunk } from "./body-codec.js";
import { HttpExchangeCoordinator } from "./http-exchange.coordinator.js";
import { HttpForwardingService } from "./http-forwarding.service.js";

describe("HttpForwardingService", () => {
  it("sends request frames and returns the streamed CLI response", async () => {
    const coordinator = new HttpExchangeCoordinator();
    const service = new HttpForwardingService(coordinator);

    const sent: string[] = [];
    const client = {
      readyState: WebSocket.OPEN,
      send: (data: string) => {
        sent.push(data);

        const parsed = parseProtocolMessage(data);
        if (!parsed.ok) {
          return;
        }

        if (parsed.value.type === MessageType.HttpRequestEnd) {
          queueMicrotask(() => {
            const startDelivered = coordinator.deliver({
              type: MessageType.HttpResponseStart,
              requestId: parsed.value.requestId,
              tunnelId: "tun-1",
              statusCode: 201,
              headers: { "x-test": "1" },
              setCookies: ["session=1"],
              hasBody: true,
            });
            expect(startDelivered).toBe(true);

            const encoded = encodeBodyChunk(Buffer.from("ok"));
            coordinator.deliver({
              type: MessageType.HttpResponseChunk,
              requestId: parsed.value.requestId,
              tunnelId: "tun-1",
              sequence: 0,
              encoding: encoded.encoding,
              data: encoded.data,
            });
            coordinator.deliver({
              type: MessageType.HttpResponseEnd,
              requestId: parsed.value.requestId,
              tunnelId: "tun-1",
            });
          });
        }
      },
    } as unknown as WebSocket;

    const tunnel: TunnelRecord = {
      id: "tun-1",
      client,
      port: 3000,
    };

    const response = await service.forward({
      tunnel,
      method: HttpMethod.POST,
      path: "/echo",
      query: { q: "1" },
      headers: { accept: "text/plain" },
      cookies: { a: "b" },
      body: Buffer.from("ping"),
    });

    expect(response.statusCode).toBe(201);
    expect(response.headers["x-test"]).toBe("1");
    expect(response.setCookies).toEqual(["session=1"]);

    const bodyText = await readBody(response.body);
    expect(bodyText).toBe("ok");

    const types = sent.map((frame) => {
      const parsed = parseProtocolMessage(frame);
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) {
        throw new Error(parsed.error);
      }
      return parsed.value.type;
    });

    expect(types).toEqual([
      MessageType.HttpRequestStart,
      MessageType.HttpRequestChunk,
      MessageType.HttpRequestEnd,
    ]);
  });

  it("rejects when the tunnel websocket is not open", async () => {
    const service = new HttpForwardingService(new HttpExchangeCoordinator());
    const tunnel: TunnelRecord = {
      id: "tun-1",
      client: { readyState: WebSocket.CLOSED, send: vi.fn() } as unknown as WebSocket,
      port: 3000,
    };

    await expect(
      service.forward({
        tunnel,
        method: HttpMethod.GET,
        path: "/",
        query: {},
        headers: {},
        cookies: {},
      }),
    ).rejects.toThrow(/not open/);
  });
});

/**
 * Collects a streamed body into a UTF-8 string.
 *
 * @param body - Streaming body.
 * @returns Decoded text.
 */
async function readBody(body: AsyncIterable<Uint8Array>): Promise<string> {
  const chunks: Buffer[] = [];
  for await (const chunk of body) {
    chunks.push(Buffer.from(chunk));
  }
  return Buffer.concat(chunks).toString("utf8");
}
