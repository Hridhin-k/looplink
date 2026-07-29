import { BadRequestException, Controller, Get, Headers, Param, Post, Query } from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";

import { toReplayHttpException } from "../replay/replay-http.js";
import { InspectorReplayResponseDto } from "./dto/inspector-replay.dto.js";
import { InspectorRequestDetailDto, InspectorRequestListDto } from "./dto/inspector-request.dto.js";
import { InspectorStatisticsDto } from "./dto/inspector-statistics.dto.js";
import { InspectorService } from "./inspector.service.js";

/**
 * Public inspector API for recorded traffic, statistics, and replay.
 *
 * No authentication — intended for local/dev dashboards. Does not participate
 * in the Layer 1 forward path.
 */
@ApiTags("inspector")
@Controller("api/v1/inspector")
export class InspectorController {
  /**
   * @param inspector - Inspector application service.
   */
  constructor(private readonly inspector: InspectorService) {}

  /**
   * Lists recorded HTTP exchanges (newest first).
   *
   * @param tunnelId - Optional tunnel filter.
   * @param limit - Optional max items.
   * @returns Summary list DTO.
   */
  @Get("requests")
  @ApiOperation({ summary: "List recorded HTTP requests" })
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
  @ApiBadRequestResponse({ description: "Invalid limit query parameter" })
  async listRequests(
    @Query("tunnelId") tunnelId?: string,
    @Query("limit") limit?: string,
    @Query("q") q?: string,
    @Headers("x-workspace-id") workspaceId?: string,
  ): Promise<InspectorRequestListDto> {
    const scopedWorkspaceId = sanitizeWorkspaceHeader(workspaceId);
    return this.inspector.listRequests({
      ...(tunnelId === undefined || tunnelId.trim().length === 0
        ? {}
        : { tunnelId: tunnelId.trim() }),
      ...(scopedWorkspaceId === undefined ? {} : { workspaceId: scopedWorkspaceId }),
      ...(limit === undefined ? {} : { limit: parseLimit(limit) }),
      ...(q === undefined || q.trim().length === 0 ? {} : { query: q }),
    });
  }

  /**
   * Returns one recorded exchange including bodies.
   *
   * @param id - Traffic request id.
   * @returns Detail DTO.
   */
  @Get("request/:id")
  @ApiOperation({ summary: "Get a recorded HTTP request by id" })
  @ApiParam({ name: "id", description: "Traffic request id" })
  @ApiOkResponse({ type: InspectorRequestDetailDto })
  @ApiNotFoundResponse({ description: "Request not found" })
  async getRequest(
    @Param("id") id: string,
    @Headers("x-workspace-id") workspaceId?: string,
  ): Promise<InspectorRequestDetailDto> {
    return this.inspector.getRequest(id, sanitizeWorkspaceHeader(workspaceId));
  }

  /**
   * Replays a recorded request through the existing forward pipeline.
   *
   * @param id - Traffic request id.
   * @returns Live replay response DTO.
   */
  @Post("replay/:id")
  @ApiOperation({ summary: "Replay a recorded HTTP request" })
  @ApiParam({ name: "id", description: "Traffic request id" })
  @ApiOkResponse({ type: InspectorReplayResponseDto })
  @ApiNotFoundResponse({ description: "Request not found" })
  async replayRequest(
    @Param("id") id: string,
    @Headers("x-workspace-id") workspaceId?: string,
  ): Promise<InspectorReplayResponseDto> {
    try {
      return await this.inspector.replayRequest(id, sanitizeWorkspaceHeader(workspaceId));
    } catch (error: unknown) {
      throw toReplayHttpException(error);
    }
  }

  /**
   * Returns aggregate traffic statistics.
   *
   * @param tunnelId - Optional tunnel scope.
   * @returns Statistics DTO.
   */
  @Get("statistics")
  @ApiOperation({ summary: "Get traffic statistics" })
  @ApiQuery({ name: "tunnelId", required: false, description: "Scope to a single tunnel" })
  @ApiOkResponse({ type: InspectorStatisticsDto })
  async getStatistics(
    @Query("tunnelId") tunnelId?: string,
    @Headers("x-workspace-id") workspaceId?: string,
  ): Promise<InspectorStatisticsDto> {
    const scoped =
      tunnelId === undefined || tunnelId.trim().length === 0 ? undefined : tunnelId.trim();
    return this.inspector.getStatistics(scoped, sanitizeWorkspaceHeader(workspaceId));
  }
}

/**
 * Parses a positive integer limit query parameter.
 *
 * @param raw - Raw query string.
 * @returns Parsed limit.
 * @throws Error When the value is not a non-negative integer.
 */
function parseLimit(raw: string): number {
  const value = Number(raw);
  if (!Number.isInteger(value) || value < 0) {
    throw new BadRequestException(`Invalid limit "${raw}": expected a non-negative integer.`);
  }
  return value;
}

function sanitizeWorkspaceHeader(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized === undefined || normalized.length === 0 ? undefined : normalized;
}
