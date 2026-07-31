import {
  BadgerEventType,
  HttpMethod,
  MemoryStorage,
  MessageType,
  ReplayError,
  ReplayErrorCode,
  StorageTrafficRecordStore,
  createEventBus,
  createTrafficBody,
  parseProtocolMessage,
  type TrafficRecord,
} from "@hridhin-k/badger-shared";
import { describe, expect, it, vi } from "vitest";
import WebSocket from "ws";

import { encodeBodyChunk } from "../http-forward/body-codec.js";
import { HttpExchangeCoordinator } from "../http-forward/http-exchange.coordinator.js";
import { HttpForwardingService } from "../http-forward/http-forwarding.service.js";
import { MemoryTunnelRepository } from "../tunnel/memory-tunnel.repository.js";
import { createAnonymousTunnelContext } from "../tunnel/tunnel-context.js";
import { TunnelManager } from "../tunnel/tunnel.manager.js";
import type { TunnelRecord } from "../tunnel/tunnel.types.js";
import { RequestReplayService } from "./request-replay.service.js";

const ANON = createAnonymousTunnelContext("anon-session-1");

/**
 * Builds a stored traffic record.
 *
 * @param overrides - Fields to replace.
 * @returns Complete record.
 */
function record(overrides: Partial<TrafficRecord> = {}): TrafficRecord {
  return {
    requestId: "req-1",
    timestamp: 1_000,
    method: HttpMethod.POST,
    path: "/echo",
    headers: { accept: "text/plain" },
    query: { n: "1" },
    body: createTrafficBody("ping"),
    status: 200,
    responseHeaders: {},
    responseBody: createTrafficBody("old"),
    latencyMs: 10,
    tunnelId: "tun-1",
    error: undefined,
    ...overrides,
  };
}

describe("RequestReplayService", () => {
  it("replays through HttpForwardingService without duplicating frame logic", async () => {
    const store = new StorageTrafficRecordStore(new MemoryStorage());
    await store.save(record());

    const coordinator = new HttpExchangeCoordinator();
    const eventBus = createEventBus();
    const forwarding = new HttpForwardingService(coordinator, eventBus);
    const tunnelManager = new TunnelManager(new MemoryTunnelRepository(), createEventBus());

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
          const end = parsed.value;
          queueMicrotask(() => {
            coordinator.deliver({
              type: MessageType.HttpResponseStart,
              requestId: end.requestId,
              tunnelId: "tun-1",
              statusCode: 201,
              headers: { "x-replay": "1" },
              setCookies: [],
              hasBody: true,
            });
            const encoded = encodeBodyChunk(Buffer.from("pong"));
            coordinator.deliver({
              type: MessageType.HttpResponseChunk,
              requestId: end.requestId,
              tunnelId: "tun-1",
              sequence: 0,
              encoding: encoded.encoding,
              data: encoded.data,
            });
            coordinator.deliver({
              type: MessageType.HttpResponseEnd,
              requestId: end.requestId,
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
      context: ANON,
      anonymousSessionId: ANON.id,
    };
    vi.spyOn(tunnelManager, "lookup").mockReturnValue(tunnel);

    const replayCompleted = vi.fn();
    eventBus.subscribe(BadgerEventType.ReplayCompleted, replayCompleted);

    const service = new RequestReplayService(store, tunnelManager, forwarding, eventBus);
    const result = await service.replay("req-1");

    expect(result.statusCode).toBe(201);
    expect(result.headers).toEqual({ "x-replay": "1" });
    expect(Buffer.from(result.body.dataBase64, "base64").toString("utf8")).toBe("pong");
    expect(result.requestBodyTruncated).toBe(false);
    expect(replayCompleted).toHaveBeenCalledTimes(1);

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

  it("throws NOT_FOUND when the traffic record is missing", async () => {
    const service = new RequestReplayService(
      new StorageTrafficRecordStore(new MemoryStorage()),
      new TunnelManager(new MemoryTunnelRepository(), createEventBus()),
      new HttpForwardingService(new HttpExchangeCoordinator(), createEventBus()),
      createEventBus(),
    );

    await expect(service.replay("missing")).rejects.toMatchObject({
      code: ReplayErrorCode.NotFound,
    });
  });

  it("throws TUNNEL_UNAVAILABLE when the tunnel is not connected", async () => {
    const store = new StorageTrafficRecordStore(new MemoryStorage());
    await store.save(record());

    const service = new RequestReplayService(
      store,
      new TunnelManager(new MemoryTunnelRepository(), createEventBus()),
      new HttpForwardingService(new HttpExchangeCoordinator(), createEventBus()),
      createEventBus(),
    );

    await expect(service.replay("req-1")).rejects.toBeInstanceOf(ReplayError);
    await expect(service.replay("req-1")).rejects.toMatchObject({
      code: ReplayErrorCode.TunnelUnavailable,
    });
  });
});
