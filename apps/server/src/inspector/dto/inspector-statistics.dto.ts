import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/**
 * HTTP method histogram entry.
 */
export class MethodCountDto {
  @ApiProperty({ example: "GET" })
  method!: string;

  @ApiProperty({ example: 12 })
  count!: number;
}

/**
 * Status code histogram entry.
 */
export class StatusCodeCountDto {
  @ApiProperty({ example: 200 })
  statusCode!: number;

  @ApiProperty({ example: 10 })
  count!: number;
}

/**
 * Top endpoint entry.
 */
export class EndpointCountDto {
  @ApiProperty({ example: "/api" })
  path!: string;

  @ApiProperty({ example: "GET" })
  method!: string;

  @ApiProperty({ example: 5 })
  count!: number;
}

/**
 * Per-tunnel statistics slice.
 */
export class TunnelStatisticsDto {
  @ApiProperty()
  tunnelId!: string;

  @ApiProperty()
  totalRequests!: number;

  @ApiPropertyOptional()
  averageLatencyMs?: number;

  @ApiPropertyOptional()
  p95LatencyMs?: number;

  @ApiProperty({ description: "Error fraction between 0 and 1.", example: 0.1 })
  errorRate!: number;

  @ApiProperty({ type: [MethodCountDto] })
  methodCounts!: MethodCountDto[];

  @ApiProperty({ type: [StatusCodeCountDto] })
  statusCodeCounts!: StatusCodeCountDto[];

  @ApiProperty({ type: [EndpointCountDto] })
  topEndpoints!: EndpointCountDto[];
}

/**
 * Aggregate traffic statistics for the inspector.
 */
export class InspectorStatisticsDto {
  @ApiProperty()
  totalRequests!: number;

  @ApiProperty({ description: "Requests per minute in the rolling window." })
  requestsPerMinute!: number;

  @ApiPropertyOptional()
  averageLatencyMs?: number;

  @ApiPropertyOptional()
  p95LatencyMs?: number;

  @ApiProperty({ description: "Error fraction between 0 and 1." })
  errorRate!: number;

  @ApiProperty({ type: [MethodCountDto] })
  methodCounts!: MethodCountDto[];

  @ApiProperty({ type: [StatusCodeCountDto] })
  statusCodeCounts!: StatusCodeCountDto[];

  @ApiProperty({ type: [EndpointCountDto] })
  topEndpoints!: EndpointCountDto[];

  @ApiProperty({ type: [TunnelStatisticsDto] })
  tunnels!: TunnelStatisticsDto[];
}
