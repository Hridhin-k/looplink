import {
  BadRequestException,
  Controller,
  ForbiddenException,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import {
  ApiBadRequestResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiTags,
} from "@nestjs/swagger";
import type { FastifyRequest } from "fastify";

import { WorkspaceContextService } from "../access/workspace-context.service.js";
import { AuthService } from "../auth/auth.service.js";
import type { AuthUser } from "../auth/auth.types.js";
import { extractBearerToken } from "../auth/extract-bearer-token.js";
import { toReplayHttpException } from "../replay/replay-http.js";
import { ApiKeyService } from "../workspaces/api-keys/api-key.service.js";
import { isApiKeyToken } from "../workspaces/workspace-crypto.js";
import { InspectorReplayResponseDto } from "./dto/inspector-replay.dto.js";
import { InspectorRequestDetailDto, InspectorRequestListDto } from "./dto/inspector-request.dto.js";
import { InspectorStatisticsDto } from "./dto/inspector-statistics.dto.js";
import { InspectorService } from "./inspector.service.js";

/**
 * Inspector API for recorded traffic, statistics, and replay.
 *
 * Workspace-scoped reads require authenticated Membership. Unscoped reads
 * remain available for local debugging of legacy untagged traffic.
 */
@ApiTags("inspector")
@Controller("api/v1/inspector")
export class InspectorController {
  constructor(
    private readonly inspector: InspectorService,
    private readonly auth: AuthService,
    private readonly apiKeys: ApiKeyService,
    private readonly workspaceContext: WorkspaceContextService,
  ) {}

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
    @Req() request: FastifyRequest,
    @Query("tunnelId") tunnelId?: string,
    @Query("limit") limit?: string,
    @Query("q") q?: string,
    @Headers("x-workspace-id") workspaceId?: string,
  ): Promise<InspectorRequestListDto> {
    const scopedWorkspaceId = await this.resolveScopedWorkspace(request, workspaceId);
    return this.inspector.listRequests({
      ...(tunnelId === undefined || tunnelId.trim().length === 0
        ? {}
        : { tunnelId: tunnelId.trim() }),
      ...(scopedWorkspaceId === undefined ? {} : { workspaceId: scopedWorkspaceId }),
      ...(limit === undefined ? {} : { limit: parseLimit(limit) }),
      ...(q === undefined || q.trim().length === 0 ? {} : { query: q }),
    });
  }

  @Get("request/:id")
  @ApiOperation({ summary: "Get a recorded HTTP request by id" })
  @ApiParam({ name: "id", description: "Traffic request id" })
  @ApiOkResponse({ type: InspectorRequestDetailDto })
  @ApiNotFoundResponse({ description: "Request not found" })
  async getRequest(
    @Req() request: FastifyRequest,
    @Param("id") id: string,
    @Headers("x-workspace-id") workspaceId?: string,
  ): Promise<InspectorRequestDetailDto> {
    return this.inspector.getRequest(
      id,
      await this.resolveScopedWorkspace(request, workspaceId),
    );
  }

  @Post("replay/:id")
  @ApiOperation({ summary: "Replay a recorded HTTP request" })
  @ApiParam({ name: "id", description: "Traffic request id" })
  @ApiOkResponse({ type: InspectorReplayResponseDto })
  @ApiNotFoundResponse({ description: "Request not found" })
  async replayRequest(
    @Req() request: FastifyRequest,
    @Param("id") id: string,
    @Headers("x-workspace-id") workspaceId?: string,
  ): Promise<InspectorReplayResponseDto> {
    try {
      return await this.inspector.replayRequest(
        id,
        await this.resolveScopedWorkspace(request, workspaceId),
      );
    } catch (error: unknown) {
      throw toReplayHttpException(error);
    }
  }

  @Get("statistics")
  @ApiOperation({ summary: "Get traffic statistics" })
  @ApiQuery({ name: "tunnelId", required: false, description: "Scope to a single tunnel" })
  @ApiOkResponse({ type: InspectorStatisticsDto })
  async getStatistics(
    @Req() request: FastifyRequest,
    @Query("tunnelId") tunnelId?: string,
    @Headers("x-workspace-id") workspaceId?: string,
  ): Promise<InspectorStatisticsDto> {
    const scoped =
      tunnelId === undefined || tunnelId.trim().length === 0 ? undefined : tunnelId.trim();
    return this.inspector.getStatistics(
      scoped,
      await this.resolveScopedWorkspace(request, workspaceId),
    );
  }

  /**
   * Never trusts client workspace IDs — verifies ACTIVE membership when scoped.
   */
  private async resolveScopedWorkspace(
    request: FastifyRequest,
    workspaceHeader: string | undefined,
  ): Promise<string | undefined> {
    const requested = sanitizeWorkspaceHeader(workspaceHeader);
    if (requested === undefined) {
      return undefined;
    }

    const authorization =
      typeof request.headers.authorization === "string"
        ? request.headers.authorization
        : undefined;
    const token = extractBearerToken(authorization);
    if (token === undefined) {
      throw new ForbiddenException("Authentication required for workspace-scoped inspector access.");
    }

    const user: AuthUser = isApiKeyToken(token)
      ? await this.apiKeys.verifyBearerToken(token)
      : { ...(await this.auth.verifyAccessToken(token)), authMethod: "jwt" };

    const authorized = await this.workspaceContext.resolve(user, requested);
    return authorized.request.workspaceId;
  }
}

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
