import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

import { TrafficBodyDto } from "./traffic-body.dto.js";

/**
 * Summary row for `GET /api/v1/inspector/requests` (bodies omitted).
 */
export class InspectorRequestSummaryDto {
  @ApiProperty({ description: "Traffic request id.", example: "req-1" })
  id!: string;

  @ApiProperty({
    description: "Epoch ms when the request was received.",
    example: 1_712_000_000_000,
  })
  timestamp!: number;

  @ApiProperty({ description: "HTTP method.", example: "GET" })
  method!: string;

  @ApiProperty({ description: "Request path.", example: "/api/users" })
  path!: string;

  @ApiPropertyOptional({ description: "HTTP status when completed.", example: 200 })
  status?: number;

  @ApiPropertyOptional({ description: "Round-trip latency in ms.", example: 42 })
  latencyMs?: number;

  @ApiProperty({ description: "Tunnel that handled the exchange.", example: "tun-1" })
  tunnelId!: string;

  @ApiPropertyOptional({
    description: "Workspace that owned the tunnel when this exchange was recorded.",
    example: "2fd2d870-0f20-4f6b-9cf6-8ee4d6a36235",
  })
  workspaceId?: string;

  @ApiPropertyOptional({ description: "Failure reason when the exchange failed." })
  error?: string;

  @ApiProperty({ description: "Original request body size in bytes.", example: 0 })
  requestBodyByteLength!: number;

  @ApiProperty({ description: "Original response body size in bytes.", example: 128 })
  responseBodyByteLength!: number;

  @ApiPropertyOptional({
    description: "Fields that matched the `q` full-text query (present only when searching).",
    type: [String],
    example: ["url", "body"],
  })
  matches?: string[];
}

/**
 * Full recorded exchange for `GET /api/v1/inspector/request/:id`.
 */
export class InspectorRequestDetailDto {
  @ApiProperty({ description: "Traffic request id.", example: "req-1" })
  id!: string;

  @ApiProperty({ description: "Epoch ms when the request was received." })
  timestamp!: number;

  @ApiProperty({ description: "HTTP method.", example: "POST" })
  method!: string;

  @ApiProperty({ description: "Request path.", example: "/echo" })
  path!: string;

  @ApiProperty({
    description: "Request headers.",
    type: "object",
    additionalProperties: true,
    example: { accept: "application/json" },
  })
  headers!: Record<string, string | readonly string[]>;

  @ApiProperty({
    description: "Parsed query-string parameters.",
    type: "object",
    additionalProperties: true,
    example: { page: "1" },
  })
  query!: Record<string, string | readonly string[]>;

  @ApiProperty({ type: TrafficBodyDto })
  body!: TrafficBodyDto;

  @ApiPropertyOptional({ description: "HTTP status when completed.", example: 201 })
  status?: number;

  @ApiProperty({
    description: "Response headers.",
    type: "object",
    additionalProperties: true,
  })
  responseHeaders!: Record<string, string | readonly string[]>;

  @ApiProperty({ type: TrafficBodyDto })
  responseBody!: TrafficBodyDto;

  @ApiPropertyOptional({ description: "Round-trip latency in ms.", example: 25 })
  latencyMs?: number;

  @ApiProperty({ description: "Tunnel that handled the exchange.", example: "tun-1" })
  tunnelId!: string;

  @ApiPropertyOptional({
    description: "Workspace that owned the tunnel when this exchange was recorded.",
    example: "2fd2d870-0f20-4f6b-9cf6-8ee4d6a36235",
  })
  workspaceId?: string;

  @ApiPropertyOptional({ description: "Failure reason when the exchange failed." })
  error?: string;
}

/**
 * Paginated/list wrapper for inspector requests.
 */
export class InspectorRequestListDto {
  @ApiProperty({ type: [InspectorRequestSummaryDto] })
  items!: InspectorRequestSummaryDto[];

  @ApiProperty({ description: "Number of items in this response.", example: 10 })
  count!: number;
}
