import { Injectable, NotFoundException } from "@nestjs/common";
import {
  matchTrafficRecordFields,
  normalizeQuery,
  toReplayResponseDto,
  type TrafficRecord,
  type TrafficSearchField,
} from "@hridhin-k/badger-shared";

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
 * Options for listing inspector requests.
 */
export interface ListInspectorRequestsOptions {
  readonly tunnelId?: string;
  readonly workspaceId?: string;
  readonly limit?: number;
  /** Case-insensitive full-text query across URL, headers, bodies, etc. */
  readonly query?: string;
}

/**
 * Application service for the inspector management API.
 *
 * Composes traffic listing, statistics, and replay — never touches forwarding.
 */
@Injectable()
export class InspectorService {
  /**
   * @param traffic - Recorded traffic access.
   * @param statistics - Aggregate metrics.
   * @param replay - Request replay through the existing forward pipeline.
   */
  constructor(
    private readonly traffic: TrafficRecorderService,
    private readonly statistics: StatisticsService,
    private readonly replay: RequestReplayService,
  ) {}

  /**
   * Lists recorded requests as summary DTOs (newest first).
   *
   * When {@link ListInspectorRequestsOptions.query} is set, bodies are loaded so
   * full-text search can cover request/response payloads; matching field ids are
   * returned on each summary.
   *
   * @param options - Optional tunnel filter, limit, and search query.
   * @returns List DTO without body payloads in the response.
   */
  async listRequests(options: ListInspectorRequestsOptions = {}): Promise<InspectorRequestListDto> {
    const query = options.query === undefined ? undefined : normalizeQuery(options.query);
    const searching = query !== undefined;

    const records = await this.traffic.list({
      ...(options.tunnelId === undefined ? {} : { tunnelId: options.tunnelId }),
      ...(options.workspaceId === undefined ? {} : { workspaceId: options.workspaceId }),
      // When searching, load all candidates (bodies included) then apply limit after filter.
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
   *
   * @param id - Traffic request id.
   * @returns Detail DTO.
   * @throws NotFoundException When the record is missing.
   */
  async getRequest(id: string, workspaceId?: string): Promise<InspectorRequestDetailDto> {
    const record = await this.traffic.findById(id);
    if (record === undefined) {
      throw new NotFoundException(`No traffic record found for id "${id}".`);
    }
    if (workspaceId !== undefined && record.workspaceId !== workspaceId) {
      throw new NotFoundException(`No traffic record found for id "${id}".`);
    }

    return toInspectorRequestDetail(record);
  }

  /**
   * Replays a recorded request through the live tunnel.
   *
   * @param id - Traffic request id.
   * @returns Replay response DTO.
   */
  async replayRequest(id: string, workspaceId?: string): Promise<InspectorReplayResponseDto> {
    const result = await this.replay.replay(id, workspaceId);
    return toInspectorReplayResponseDto(toReplayResponseDto(result));
  }

  /**
   * Computes traffic statistics DTOs.
   *
   * @param tunnelId - Optional tunnel scope.
   * @returns Statistics DTO.
   */
  async getStatistics(tunnelId?: string, workspaceId?: string): Promise<InspectorStatisticsDto> {
    const stats = await this.statistics.getStatistics({
      ...(tunnelId === undefined ? {} : { tunnelId }),
      ...(workspaceId === undefined ? {} : { workspaceId }),
    });
    return toInspectorStatisticsDto(stats);
  }
}
