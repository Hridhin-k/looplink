import { BadRequestException } from "@nestjs/common";
import { describe, expect, it, vi } from "vitest";

import { ReplayError, ReplayErrorCode } from "@hridhin-k/badger-shared";

import { InspectorController } from "./inspector.controller.js";
import type { InspectorService } from "./inspector.service.js";

function createController(inspector: InspectorService): InspectorController {
  return new InspectorController(
    inspector,
    { verifyAccessToken: vi.fn() } as never,
    { verifyBearerToken: vi.fn() } as never,
    { resolve: vi.fn() } as never,
  );
}

const bareRequest = { headers: {} } as never;

describe("InspectorController", () => {
  it("lists requests with parsed query options", async () => {
    const inspector = {
      listRequests: vi.fn().mockResolvedValue({ items: [], count: 0 }),
    } as unknown as InspectorService;

    const controller = createController(inspector);
    await controller.listRequests(bareRequest, "tun-1", "10");

    expect(inspector.listRequests).toHaveBeenCalledWith({ tunnelId: "tun-1", limit: 10 });
  });

  it("rejects invalid limit values", async () => {
    const controller = createController({
      listRequests: vi.fn(),
    } as unknown as InspectorService);

    await expect(controller.listRequests(bareRequest, undefined, "nope")).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it("returns request detail from the service", async () => {
    const inspector = {
      getRequest: vi.fn().mockResolvedValue({ id: "req-1", path: "/" }),
    } as unknown as InspectorService;

    const controller = createController(inspector);
    await expect(controller.getRequest(bareRequest, "req-1")).resolves.toEqual(
      expect.objectContaining({ id: "req-1" }),
    );
  });

  it("maps replay failures to HTTP exceptions", async () => {
    const inspector = {
      replayRequest: vi
        .fn()
        .mockRejectedValue(new ReplayError(ReplayErrorCode.NotFound, "missing")),
    } as unknown as InspectorService;

    const controller = createController(inspector);
    await expect(controller.replayRequest(bareRequest, "missing")).rejects.toSatisfy(
      (error: unknown) =>
        typeof error === "object" &&
        error !== null &&
        "getStatus" in error &&
        typeof (error as { getStatus: () => number }).getStatus === "function" &&
        (error as { getStatus: () => number }).getStatus() === 404,
    );
  });

  it("passes statistics tunnel scope through", async () => {
    const inspector = {
      getStatistics: vi.fn().mockResolvedValue({ totalRequests: 0 }),
    } as unknown as InspectorService;

    const controller = createController(inspector);
    await controller.getStatistics(bareRequest, "tun-9");
    expect(inspector.getStatistics).toHaveBeenCalledWith("tun-9", undefined);
  });
});
