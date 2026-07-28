import { Controller, Param, Post } from "@nestjs/common";
import { toReplayResponseDto, type ReplayResponseDto } from "@hridhin-k/badger-shared";

import { toReplayHttpException } from "./replay-http.js";
import { RequestReplayService } from "./request-replay.service.js";

/**
 * Management API for replaying recorded HTTP traffic.
 *
 * Path: `POST /api/v1/traffic/:requestId/replay`
 *
 * Prefer {@link import("../inspector/inspector.controller.js").InspectorController}
 * (`POST /api/v1/inspector/replay/:id`) for new clients.
 */
@Controller("api/v1/traffic")
export class ReplayController {
  /**
   * @param replay - Application replay service.
   */
  constructor(private readonly replay: RequestReplayService) {}

  /**
   * Replays a stored request through the live tunnel forward pipeline.
   *
   * @param requestId - Traffic record id.
   * @returns Replay response DTO.
   */
  @Post(":requestId/replay")
  async replayRequest(@Param("requestId") requestId: string): Promise<ReplayResponseDto> {
    try {
      const result = await this.replay.replay(requestId);
      return toReplayResponseDto(result);
    } catch (error: unknown) {
      throw toReplayHttpException(error);
    }
  }
}
