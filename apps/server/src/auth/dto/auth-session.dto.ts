import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/**
 * Public user identity returned by auth endpoints.
 */
export class AuthUserDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  email!: string | null;

  @ApiPropertyOptional({ enum: ["jwt", "api_key"] })
  authMethod?: "jwt" | "api_key";

  @ApiPropertyOptional({ format: "uuid", description: "Present for API key auth" })
  workspaceId?: string;

  @ApiPropertyOptional({ format: "uuid", description: "Present for API key auth" })
  apiKeyId?: string;
}

/**
 * Session tokens + user returned after login or refresh.
 */
export class AuthSessionDto {
  @ApiProperty()
  accessToken!: string;

  @ApiProperty()
  refreshToken!: string;

  @ApiProperty({ description: "Unix epoch seconds when the access token expires" })
  expiresAt!: number;

  @ApiProperty({ type: AuthUserDto })
  user!: AuthUserDto;
}
