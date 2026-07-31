import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { ReplayError, ReplayErrorCode } from "@hridhin-k/badger-shared";

import type { WorkspacePermission } from "../workspaces/workspace.permissions.js";
import { ContextType } from "../context/context-type.js";
import type { TunnelContext } from "../context/tunnel-context.interface.js";
import { InspectorController } from "./inspector.controller.js";
import type { InspectorService } from "./inspector.service.js";

const context: TunnelContext = Object.freeze({
  contextId: "ctx-1",
  contextType: ContextType.Workspace,
  tunnelId: null,
  workspaceId: "ws-1",
  anonymousSessionId: null,
  permissions: new Set<WorkspacePermission>(["inspector:read", "inspector:replay"]),
  metadata: Object.freeze({}),
});

describe("InspectorController", () => {
  it("lists requests with TunnelContext", async () => {
    const inspector = {
      listRequests: vi.fn().mockResolvedValue({ items: [], count: 0 }),
    } as unknown as InspectorService;

    const controller = new InspectorController(inspector);
    await controller.listRequests(context, "tun-1", "10");

    expect(inspector.listRequests).toHaveBeenCalledWith(context, {
      tunnelId: "tun-1",
      limit: 10,
    });
  });

  it("rejects invalid limit values", async () => {
    const controller = new InspectorController({
      listRequests: vi.fn(),
    } as unknown as InspectorService);

    await expect(controller.listRequests(context, undefined, "nope")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("returns request detail from the service", async () => {
    const inspector = {
      getRequest: vi.fn().mockResolvedValue({ id: "req-1", path: "/" }),
    } as unknown as InspectorService;

    const controller = new InspectorController(inspector);
    await expect(controller.getRequest(context, "req-1")).resolves.toEqual(
      expect.objectContaining({ id: "req-1" }),
    );
    expect(inspector.getRequest).toHaveBeenCalledWith(context, "req-1");
  });

  it("maps replay failures to HTTP exceptions", async () => {
    const inspector = {
      replayRequest: vi
        .fn()
        .mockRejectedValue(new ReplayError(ReplayErrorCode.NotFound, "missing")),
    } as unknown as InspectorService;

    const controller = new InspectorController(inspector);
    await expect(controller.replayRequest(context, "missing")).rejects.toSatisfy(
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "getStatus" in error &&
        typeof (error as { getStatus: () => number }).getStatus === "function" &&
        (error as { getStatus: () => number }).getStatus() === 404,
    );
  });

  it("passes statistics tunnel scope through TunnelContext", async () => {
    const inspector = {
      getStatistics: vi.fn().mockResolvedValue({ totalRequests: 0 }),
    } as unknown as InspectorService;

    const controller = new InspectorController(inspector);
    await controller.getStatistics(context, "tun-9");
    expect(inspector.getStatistics).toHaveBeenCalledWith(context, "tun-9");
  });
});
