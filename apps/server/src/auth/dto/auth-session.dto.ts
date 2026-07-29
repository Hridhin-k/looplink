import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

/**
 * Public user identity returned by auth endpoints.
 */
export class AuthUserDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  email!: string | null;
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
