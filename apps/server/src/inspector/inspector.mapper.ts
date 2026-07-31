import type {
  ReplayResponseDto,
  TrafficRecord,
  TrafficSearchField,
  TrafficStatistics,
} from "@hridhin-k/badger-shared";

import type { InspectorReplayResponseDto } from "./dto/inspector-replay.dto.js";
import type {
  InspectorRequestDetailDto,
  InspectorRequestListDto,
  InspectorRequestSummaryDto,
} from "./dto/inspector-request.dto.js";
import type {
  InspectorStatisticsDto,
  TunnelStatisticsDto,
} from "./dto/inspector-statistics.dto.js";
import type { TrafficBodyDto } from "./dto/traffic-body.dto.js";

/**
 * Maps a {@link TrafficRecord} to an inspector list summary (no body payloads).
 *
 * @param record - Stored traffic record.
 * @returns Summary DTO.
 */
export function toInspectorRequestSummary(
  record: TrafficRecord,
  matches?: readonly TrafficSearchField[],
): InspectorRequestSummaryDto {
  const dto: InspectorRequestSummaryDto = {
    id: record.requestId,
    timestamp: record.timestamp,
    method: record.method,
    path: record.path,
    tunnelId: record.tunnelId,
    requestBodyByteLength: record.body.byteLength,
    responseBodyByteLength: record.responseBody.byteLength,
  };
  if (record.workspaceId !== undefined) {
    dto.workspaceId = record.workspaceId;
  }

  if (record.status !== undefined) {
    dto.status = record.status;
  }
  if (record.latencyMs !== undefined) {
    dto.latencyMs = record.latencyMs;
  }
  if (record.error !== undefined) {
    dto.error = record.error;
  }
  if (matches !== undefined && matches.length > 0) {
    dto.matches = [...matches];
  }

  return dto;
}

/**
 * Maps a {@link TrafficRecord} to a full inspector detail DTO.
 *
 * @param record - Stored traffic record.
 * @returns Detail DTO.
 */
export function toInspectorRequestDetail(record: TrafficRecord): InspectorRequestDetailDto {
  const dto: InspectorRequestDetailDto = {
    id: record.requestId,
    timestamp: record.timestamp,
    method: record.method,
    path: record.path,
    headers: { ...record.headers },
    query: { ...record.query },
    body: toTrafficBodyDto(record.body),
    responseHeaders: { ...record.responseHeaders },
    responseBody: toTrafficBodyDto(record.responseBody),
    tunnelId: record.tunnelId,
  };
  if (record.workspaceId !== undefined) {
    dto.workspaceId = record.workspaceId;
  }

  if (record.status !== undefined) {
    dto.status = record.status;
  }
  if (record.latencyMs !== undefined) {
    dto.latencyMs = record.latencyMs;
  }
  if (record.error !== undefined) {
    dto.error = record.error;
  }

  return dto;
}

/**
 * Wraps summaries in a list DTO.
 *
 * @param records - Traffic records (newest first).
 * @param matchesById - Optional per-request matched search fields.
 * @returns List DTO.
 */
export function toInspectorRequestList(
  records: readonly TrafficRecord[],
  matchesById?: ReadonlyMap<string, readonly TrafficSearchField[]>,
): InspectorRequestListDto {
  const items = records.map((record) =>
    toInspectorRequestSummary(record, matchesById?.get(record.requestId)),
  );
  return { items, count: items.length };
}

/**
 * Maps domain statistics to an inspector DTO.
 *
 * @param stats - Computed traffic statistics.
 * @returns Statistics DTO.
 */
export function toInspectorStatisticsDto(stats: TrafficStatistics): InspectorStatisticsDto {
  const dto: InspectorStatisticsDto = {
    totalRequests: stats.totalRequests,
    requestsPerMinute: stats.requestsPerMinute,
    errorRate: stats.errorRate,
    methodCounts: stats.methodCounts.map((entry) => ({ ...entry })),
    statusCodeCounts: stats.statusCodeCounts.map((entry) => ({ ...entry })),
    topEndpoints: stats.topEndpoints.map((entry) => ({ ...entry })),
    tunnels: stats.tunnels.map(toTunnelStatisticsDto),
  };

  if (stats.averageLatencyMs !== undefined) {
    dto.averageLatencyMs = stats.averageLatencyMs;
  }
  if (stats.p95LatencyMs !== undefined) {
    dto.p95LatencyMs = stats.p95LatencyMs;
  }

  return dto;
}

/**
 * Maps a shared replay DTO to the inspector replay response class shape.
 *
 * @param result - Shared replay response.
 * @returns Inspector replay DTO.
 */
export function toInspectorReplayResponseDto(
  result: ReplayResponseDto,
): InspectorReplayResponseDto {
  return {
    originalRequestId: result.originalRequestId,
    tunnelId: result.tunnelId,
    method: result.method,
    path: result.path,
    statusCode: result.statusCode,
    headers: { ...result.headers },
    setCookies: [...result.setCookies],
    bodyBase64: result.bodyBase64,
    bodyByteLength: result.bodyByteLength,
    bodyTruncated: result.bodyTruncated,
    requestBodyTruncated: result.requestBodyTruncated,
  };
}

/**
 * @param body - Traffic body snapshot.
 * @returns Body DTO.
 */
function toTrafficBodyDto(body: {
  readonly byteLength: number;
  readonly truncated: boolean;
  readonly dataBase64: string;
}): TrafficBodyDto {
  return {
    byteLength: body.byteLength,
    truncated: body.truncated,
    dataBase64: body.dataBase64,
  };
}

/**
 * @param tunnel - Per-tunnel statistics.
 * @returns Tunnel statistics DTO.
 */
function toTunnelStatisticsDto(tunnel: TrafficStatistics["tunnels"][number]): TunnelStatisticsDto {
  const dto: TunnelStatisticsDto = {
    tunnelId: tunnel.tunnelId,
    totalRequests: tunnel.totalRequests,
    errorRate: tunnel.errorRate,
    methodCounts: tunnel.methodCounts.map((entry) => ({ ...entry })),
    statusCodeCounts: tunnel.statusCodeCounts.map((entry) => ({ ...entry })),
    topEndpoints: tunnel.topEndpoints.map((entry) => ({ ...entry })),
  };

  if (tunnel.averageLatencyMs !== undefined) {
    dto.averageLatencyMs = tunnel.averageLatencyMs;
  }
  if (tunnel.p95LatencyMs !== undefined) {
    dto.p95LatencyMs = tunnel.p95LatencyMs;
  }

  return dto;
}
