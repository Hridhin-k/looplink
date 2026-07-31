import { ForbiddenException, Injectable, NotFoundException } from "@nestjs/common";
import {
  matchTrafficRecordFields,
  normalizeQuery,
  toReplayResponseDto,
  type TrafficRecord,
  type TrafficSearchField,
} from "@hridhin-k/badger-shared";

import type { TunnelContext } from "../context/tunnel-context.interface.js";
import { RequestReplayService } from "../replay/request-replay.service.js";
import { StatisticsService } from "../statistics/statistics.service.js";
import { TrafficRecorderService } from "../traffic/traffic-recorder.service.js";
import type { InspectorReplayResponseDto } from "./dto/inspector-replay.dto.js";
import type {
  InspectorRequestDetailDto,
  InspectorRequestListDto,
} from "./dto/inspector-request.dto.js";
import type { InspectorStatisticsDto } from "./dto/inspector-statistics.dto.js";
import {
  toInspectorReplayResponseDto,
  toInspectorRequestDetail,
  toInspectorRequestList,
  toInspectorStatisticsDto,
} from "./inspector.mapper.js";

/**
 * Options for listing inspector requests (workspace comes from TunnelContext).
 */
export interface ListInspectorRequestsOptions {
  readonly tunnelId?: string;
  readonly limit?: number;
  /** Case-insensitive full-text query across URL, headers, bodies, etc. */
  readonly query?: string;
}

/**
 * Application service for the inspector management API.
 *
 * Consumes only {@link TunnelContext} — never authentication or membership APIs.
 */
@Injectable()
export class InspectorService {
  constructor(
    private readonly traffic: TrafficRecorderService,
    private readonly statistics: StatisticsService,
    private readonly replay: RequestReplayService,
  ) {}

  /**
   * Lists recorded requests as summary DTOs (newest first).
   */
  async listRequests(
    context: TunnelContext,
    options: ListInspectorRequestsOptions = {},
  ): Promise<InspectorRequestListDto> {
    const workspaceId = requireWorkspaceId(context);
    const query = options.query === undefined ? undefined : normalizeQuery(options.query);
    const searching = query !== undefined;

    const records = await this.traffic.list({
      workspaceId,
      ...(options.tunnelId === undefined ? {} : { tunnelId: options.tunnelId }),
      ...(searching || options.limit === undefined ? {} : { limit: options.limit }),
      includeBodies: searching,
    });

    if (!searching) {
      return toInspectorRequestList(records);
    }

    const matched: TrafficRecord[] = [];
    const matchesById = new Map<string, readonly TrafficSearchField[]>();

    for (const record of records) {
      const fields = matchTrafficRecordFields(record, query);
      if (fields === undefined) {
        continue;
      }
      matched.push(record);
      matchesById.set(record.requestId, fields);
      if (options.limit !== undefined && matched.length >= options.limit) {
        break;
      }
    }

    return toInspectorRequestList(matched, matchesById);
  }

  /**
   * Returns a single recorded request with bodies.
   */
  async getRequest(context: TunnelContext, id: string): Promise<InspectorRequestDetailDto> {
    const workspaceId = requireWorkspaceId(context);
    const record = await this.traffic.findById(id);
    if (record === undefined || record.workspaceId !== workspaceId) {
      throw new NotFoundException(`No traffic record found for id "${id}".`);
    }

    return toInspectorRequestDetail(record);
  }

  /**
   * Replays a recorded request through the live tunnel.
   */
  async replayRequest(context: TunnelContext, id: string): Promise<InspectorReplayResponseDto> {
    const workspaceId = requireWorkspaceId(context);
    const result = await this.replay.replay(id, workspaceId);
    return toInspectorReplayResponseDto(toReplayResponseDto(result));
  }

  /**
   * Computes traffic statistics DTOs.
   */
  async getStatistics(
    context: TunnelContext,
    tunnelId: string | undefined,
  ): Promise<InspectorStatisticsDto> {
    const workspaceId = requireWorkspaceId(context);
    const stats = await this.statistics.getStatistics({
      workspaceId,
      ...(tunnelId === undefined ? {} : { tunnelId }),
    });
    return toInspectorStatisticsDto(stats);
  }
}

function requireWorkspaceId(context: TunnelContext): string {
  if (context.workspaceId === null || context.workspaceId.length === 0) {
    throw new ForbiddenException("Inspector requires a workspace-scoped TunnelContext.");
  }
  return context.workspaceId;
}
