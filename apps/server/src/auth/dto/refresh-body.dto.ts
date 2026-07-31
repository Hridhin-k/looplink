import { ApiProperty } from "@nestjs/swagger";

/**
 * Refresh-token payload for renewing an access token.
 */
export class RefreshBodyDto {
  @ApiProperty()
  refreshToken!: string;
}
