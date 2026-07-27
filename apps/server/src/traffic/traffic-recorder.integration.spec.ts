import {
  BadgerEventType,
  HttpMethod,
  MessageType,
  createEventBus,
  parseProtocolMessage,
} from "@hridhin-k/badger-shared";
import { describe, expect, it } from "vitest";
import WebSocket from "ws";

import type { TunnelRecord } from "../tunnel/tunnel.types.js";
import { encodeBodyChunk } from "../http-forward/body-codec.js";
import { HttpExchangeCoordinator } from "../http-forward/http-exchange.coordinator.js";
import { HttpForwardingService } from "../http-forward/http-forwarding.service.js";
import { MemoryTrafficRecordStore } from "./memory-traffic-record.store.js";
import { TrafficRecorderService } from "./traffic-recorder.service.js";

describe("TrafficRecorder integration", () => {
  it("records a live forward without altering the streamed response", async () => {
    const eventBus = createEventBus();
    const recorder = new TrafficRecorderService(eventBus, new MemoryTrafficRecordStore());
    recorder.onModuleInit();

    const coordinator = new HttpExchangeCoordinator();
    const service = new HttpForwardingService(coordinator, eventBus);

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
            coordinator.deliver({
              type: MessageType.HttpResponseStart,
              requestId: parsed.value.requestId,
              tunnelId: "tun-1",
              statusCode: 200,
              headers: { "content-type": "text/plain" },
              setCookies: [],
              hasBody: true,
            });

            const encoded = encodeBodyChunk(Buffer.from("pong"));
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
      query: {},
      headers: { accept: "text/plain" },
      cookies: {},
      body: Buffer.from("ping"),
    });

    expect(response.statusCode).toBe(200);

    const bodyText = await readBody(response.body);
    expect(bodyText).toBe("pong");

    const records = recorder.list();
    expect(records).toHaveLength(1);

    const [saved] = records;
    expect(saved).toEqual(
      expect.objectContaining({
        tunnelId: "tun-1",
        method: HttpMethod.POST,
        path: "/echo",
        status: 200,
        headers: { accept: "text/plain" },
        responseHeaders: { "content-type": "text/plain" },
      }),
    );
    expect(Buffer.from(saved?.body ?? []).toString("utf8")).toBe("ping");
    expect(Buffer.from(saved?.responseBody ?? []).toString("utf8")).toBe("pong");
    expect(saved?.latencyMs).toBeGreaterThanOrEqual(0);
    expect(typeof saved?.requestId).toBe("string");

    // Forwarding still produced protocol frames independently of the recorder.
    expect(sent.length).toBeGreaterThan(0);
    expect(eventBus).toBeDefined();
    expect(BadgerEventType.RequestReceived).toBe("RequestReceived");

    recorder.onModuleDestroy();
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
