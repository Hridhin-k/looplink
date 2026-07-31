import {
  HttpMethod,
  MemoryStorage,
  ReplayError,
  ReplayErrorCode,
  StorageTrafficRecordStore,
  createTrafficBody,
  type TrafficRecord,
} from "@hridhin-k/badger-shared";
import { NotFoundException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { ContextType } from "../context/context-type.js";
import type { TunnelContext } from "../context/tunnel-context.interface.js";
import type { RequestReplayService } from "../replay/request-replay.service.js";
import type { StatisticsService } from "../statistics/statistics.service.js";
import { TrafficRecorderService } from "../traffic/traffic-recorder.service.js";
import type { WorkspacePermission } from "../workspaces/workspace.permissions.js";
import { InspectorService } from "./inspector.service.js";

const WORKSPACE_ID = "ws-1";

const context: TunnelContext = Object.freeze({
  contextId: "ctx-1",
  contextType: ContextType.Workspace,
  tunnelId: null,
  workspaceId: WORKSPACE_ID,
  anonymousSessionId: null,
  permissions: new Set<WorkspacePermission>(["inspector:read", "inspector:replay"]),
  metadata: Object.freeze({}),
});

/**
 * Builds a traffic record for service tests.
 */
function record(overrides: Partial<TrafficRecord> = {}): TrafficRecord {
  return {
    requestId: "req-1",
    timestamp: 50_000,
    method: HttpMethod.GET,
    path: "/health",
    headers: {},
    query: {},
    body: createTrafficBody(undefined),
    status: 200,
    responseHeaders: {},
    responseBody: createTrafficBody(undefined),
    latencyMs: 5,
    tunnelId: "tun-1",
    workspaceId: WORKSPACE_ID,
    error: undefined,
    ...overrides,
  };
}

describe("InspectorService", () => {
  it("lists and gets recorded requests as DTOs", async () => {
    const store = new StorageTrafficRecordStore(new MemoryStorage());
    await store.save(record({ requestId: "a", path: "/a", timestamp: 1 }));
    await store.save(record({ requestId: "b", path: "/b", timestamp: 2 }));

    const traffic = {
      list: (options?: {
        workspaceId?: string;
        tunnelId?: string;
        limit?: number;
        includeBodies?: boolean;
      }) => store.list(options),
      findById: (id: string) => store.findById(id),
    } as unknown as TrafficRecorderService;

    const statistics = {
      getStatistics: vi.fn().mockResolvedValue({
        totalRequests: 2,
        requestsPerMinute: 2,
        averageLatencyMs: 5,
        p95LatencyMs: 5,
        errorRate: 0,
        methodCounts: [{ method: "GET", count: 2 }],
        statusCodeCounts: [{ statusCode: 200, count: 2 }],
        topEndpoints: [{ method: "GET", path: "/a", count: 1 }],
        tunnels: [],
      }),
    } as unknown as StatisticsService;

    const replay = {
      replay: vi.fn(),
    } as unknown as RequestReplayService;

    const service = new InspectorService(traffic, statistics, replay);

    const list = await service.listRequests(context, { limit: 1 });
    expect(list.count).toBe(1);
    expect(list.items[0]?.id).toBe("b");

    const detail = await service.getRequest(context, "a");
    expect(detail.path).toBe("/a");

    const stats = await service.getStatistics(context, "tun-1");
    expect(statistics.getStatistics).toHaveBeenCalledWith({
      tunnelId: "tun-1",
      workspaceId: WORKSPACE_ID,
    });
    expect(stats.totalRequests).toBe(2);
  });

  it("throws NotFoundException for missing request detail", async () => {
    const traffic = {
      findById: vi.fn().mockResolvedValue(undefined),
    } as unknown as TrafficRecorderService;

    const service = new InspectorService(
      traffic,
      { getStatistics: vi.fn() } as unknown as StatisticsService,
      { replay: vi.fn() } as unknown as RequestReplayService,
    );

    await expect(service.getRequest(context, "missing")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("throws NotFoundException when record belongs to another workspace", async () => {
    const traffic = {
      findById: vi.fn().mockResolvedValue(record({ workspaceId: "other-ws" })),
    } as unknown as TrafficRecorderService;

    const service = new InspectorService(
      traffic,
      { getStatistics: vi.fn() } as unknown as StatisticsService,
      { replay: vi.fn() } as unknown as RequestReplayService,
    );

    await expect(service.getRequest(context, "req-1")).rejects.toBeInstanceOf(NotFoundException);
  });

  it("delegates replay and maps the response DTO", async () => {
    const replay = {
      replay: vi.fn().mockResolvedValue({
        originalRequestId: "req-1",
        tunnelId: "tun-1",
        method: HttpMethod.POST,
        path: "/echo",
        statusCode: 201,
        headers: { "x-test": "1" },
        setCookies: [],
        body: createTrafficBody("pong"),
        requestBodyTruncated: false,
      }),
    } as unknown as RequestReplayService;

    const service = new InspectorService(
      {} as TrafficRecorderService,
      { getStatistics: vi.fn() } as unknown as StatisticsService,
      replay,
    );

    const result = await service.replayRequest(context, "req-1");
    expect(replay.replay).toHaveBeenCalledWith("req-1", WORKSPACE_ID);
    expect(result.statusCode).toBe(201);
    expect(result.bodyBase64.length).toBeGreaterThan(0);
  });

  it("surfaces ReplayError from the replay service", async () => {
    const replay = {
      replay: vi.fn().mockRejectedValue(new ReplayError(ReplayErrorCode.NotFound, "missing")),
    } as unknown as RequestReplayService;

    const service = new InspectorService(
      {} as TrafficRecorderService,
      { getStatistics: vi.fn() } as unknown as StatisticsService,
      replay,
    );

    await expect(service.replayRequest(context, "missing")).rejects.toMatchObject({
      code: ReplayErrorCode.NotFound,
    });
  });
});
