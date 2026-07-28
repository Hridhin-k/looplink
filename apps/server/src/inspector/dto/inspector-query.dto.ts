import { ApiPropertyOptional } from "@nestjs/swagger";

/**
 * Query parameters for listing inspector requests.
 */
export class ListInspectorRequestsQueryDto {
  @ApiPropertyOptional({ description: "Filter by tunnel id." })
  tunnelId?: string;

  @ApiPropertyOptional({
    description: "Maximum number of records to return (newest first).",
    example: 50,
  })
  limit?: string;
}

/**
 * Query parameters for inspector statistics.
 */
export class InspectorStatisticsQueryDto {
  @ApiPropertyOptional({ description: "Scope statistics to a single tunnel." })
  tunnelId?: string;
}
