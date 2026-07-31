import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class InviteMemberBodyDto {
  @ApiProperty({ example: "dev@example.com" })
  email!: string;

  @ApiProperty({ enum: ["admin", "developer", "viewer"], example: "developer" })
  role!: "admin" | "developer" | "viewer";
}

export class AcceptInvitationBodyDto {
  @ApiProperty()
  token!: string;
}

export class UpdateWorkspaceBodyDto {
  @ApiPropertyOptional()
  name?: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  description?: string | null;

  @ApiPropertyOptional({ type: "object", additionalProperties: true })
  settings?: Record<string, unknown>;
}

export class UpdateMemberRoleBodyDto {
  @ApiProperty({ enum: ["admin", "developer", "viewer"] })
  role!: "admin" | "developer" | "viewer";
}

export class CreateApiKeyBodyDto {
  @ApiProperty({ example: "CI pipeline" })
  name!: string;

  @ApiPropertyOptional({ nullable: true, type: String, description: "ISO expiry timestamp" })
  expiresAt?: string | null;
}
