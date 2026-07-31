import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { CurrentTunnelContext } from "../context/decorators/current-tunnel-context.decorator.js";
import { ContextAuthGuard } from "../context/guards/context-auth.guard.js";
import { RequireContextPermission } from "../context/guards/require-context-permission.decorator.js";
import type { TunnelContext } from "../context/tunnel-context.interface.js";
import { toReplayHttpException } from "../replay/replay-http.js";
import { InspectorReplayResponseDto } from "./dto/inspector-replay.dto.js";
import { InspectorRequestDetailDto, InspectorRequestListDto } from "./dto/inspector-request.dto.js";
import { InspectorStatisticsDto } from "./dto/inspector-statistics.dto.js";
import { InspectorService } from "./inspector.service.js";

/**
 * Inspector API for recorded traffic, statistics, and replay.
 *
 * Controllers resolve {@link TunnelContext} via the Context Engine. The service
 * never sees JWTs, memberships, or Supabase.
 */
@ApiTags("inspector")
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, ContextAuthGuard)
@Controller("api/v1/inspector")
export class InspectorController {
  constructor(private readonly inspector: InspectorService) {}

  @Get("requests")
  @RequireContextPermission("inspector:read")
  @ApiOperation({ summary: "List recorded HTTP requests for the active workspace" })
  @ApiQuery({ name: "tunnelId", required: false, description: "Filter by tunnel id" })
  @ApiQuery({
    name: "limit",
    required: false,
    description: "Maximum number of records (newest first)",
    type: Number,
  })
  @ApiQuery({
    name: "q",
    required: false,
    description:
      "Full-text search across URL, headers, method, body, response, tunnel, status, and timestamp",
  })
  @ApiOkResponse({ type: InspectorRequestListDto })
  @ApiUnauthorizedResponse({ description: "Missing or invalid Bearer token" })
  @ApiForbiddenResponse({ description: "Insufficient inspector permissions" })
  @ApiBadRequestResponse({ description: "Invalid limit query parameter" })
  async listRequests(
    @CurrentTunnelContext() context: TunnelContext,
    @Query("tunnelId") tunnelId?: string,
    @Query("limit") limit?: string,
    @Query("q") q?: string,
  ): Promise<InspectorRequestListDto> {
    return this.inspector.listRequests(context, {
      ...(tunnelId === undefined || tunnelId.trim().length === 0
        ? {}
        : { tunnelId: tunnelId.trim() }),
      ...(limit === undefined ? {} : { limit: parseLimit(limit) }),
      ...(q === undefined || q.trim().length === 0 ? {} : { query: q }),
    });
  }

  @Get("request/:id")
  @RequireContextPermission("inspector:read")
  @ApiOperation({ summary: "Get a recorded HTTP request by id" })
  @ApiParam({ name: "id", description: "Traffic request id" })
  @ApiOkResponse({ type: InspectorRequestDetailDto })
  @ApiNotFoundResponse({ description: "Request not found in this workspace" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid Bearer token" })
  async getRequest(
    @CurrentTunnelContext() context: TunnelContext,
    @Param("id") id: string,
  ): Promise<InspectorRequestDetailDto> {
    return this.inspector.getRequest(context, id);
  }

  @Post("replay/:id")
  @RequireContextPermission("inspector:replay")
  @ApiOperation({ summary: "Replay a recorded HTTP request" })
  @ApiParam({ name: "id", description: "Traffic request id" })
  @ApiOkResponse({ type: InspectorReplayResponseDto })
  @ApiNotFoundResponse({ description: "Request not found in this workspace" })
  @ApiUnauthorizedResponse({ description: "Missing or invalid Bearer token" })
  @ApiForbiddenResponse({ description: "Insufficient inspector permissions" })
  async replayRequest(
    @CurrentTunnelContext() context: TunnelContext,
    @Param("id") id: string,
  ): Promise<InspectorReplayResponseDto> {
    try {
      return await this.inspector.replayRequest(context, id);
    } catch (error: unknown) {
      throw toReplayHttpException(error);
    }
  }

  @Get("statistics")
  @RequireContextPermission("inspector:read")
  @ApiOperation({ summary: "Get traffic statistics for the active workspace" })
  @ApiQuery({ name: "tunnelId", required: false, description: "Scope to a single tunnel" })
  @ApiOkResponse({ type: InspectorStatisticsDto })
  @ApiUnauthorizedResponse({ description: "Missing or invalid Bearer token" })
  async getStatistics(
    @CurrentTunnelContext() context: TunnelContext,
    @Query("tunnelId") tunnelId?: string,
  ): Promise<InspectorStatisticsDto> {
    const scoped =
      tunnelId === undefined || tunnelId.trim().length === 0 ? undefined : tunnelId.trim();
    return this.inspector.getStatistics(context, scoped);
  }
}

function parseLimit(raw: string): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new BadRequestException(`Invalid limit "${raw}": expected a non-negative integer.`);
  }
  return value;
}
