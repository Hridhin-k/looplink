import { Controller, Param, Post, UseGuards } from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";
import { toReplayResponseDto, type ReplayResponseDto } from "@hridhin-k/badger-shared";

import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { CurrentTunnelContext } from "../context/decorators/current-tunnel-context.decorator.js";
import { ContextAuthGuard } from "../context/guards/context-auth.guard.js";
import { RequireContextPermission } from "../context/guards/require-context-permission.decorator.js";
import type { TunnelContext } from "../context/tunnel-context.interface.js";
import { toReplayHttpException } from "./replay-http.js";
import { RequestReplayService } from "./request-replay.service.js";

/**
 * Legacy management API for replaying recorded HTTP traffic.
 *
 * Path: `POST /api/v1/traffic/:requestId/replay`
 *
 * Prefer `POST /api/v1/inspector/replay/:id` for new clients.
 */
@ApiTags("traffic")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ContextAuthGuard)
@Controller("api/v1/traffic")
export class ReplayController {
  constructor(private readonly replay: RequestReplayService) {}

  @Post(":requestId/replay")
  @RequireContextPermission("inspector:replay")
  @ApiOperation({ summary: "Replay a recorded HTTP request (legacy path)" })
  @ApiOkResponse({ description: "Replay completed" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid Bearer token" })
  @ApiForbiddenResponse({ description: "Insufficient inspector permissions" })
  @ApiNotFoundResponse({ description: "Request not found in this workspace" })
  async replayRequest(
    @CurrentTunnelContext() context: TunnelContext,
    @Param("requestId") requestId: string,
  ): Promise<ReplayResponseDto> {
    try {
      if (context.workspaceId === null) {
        throw new Error("Workspace context required.");
      }
      const result = await this.replay.replay(requestId, context.workspaceId);
      return toReplayResponseDto(result);
    } catch (error: unknown) {
      throw toReplayHttpException(error);
    }
  }
}
