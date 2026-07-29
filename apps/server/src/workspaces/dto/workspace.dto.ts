import { ApiProperty, ApiPropertyOptional } from "@nestjs/swagger";

export class WorkspaceDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ enum: ["personal", "shared"] })
  kind!: "personal" | "shared";

  @ApiProperty({ format: "uuid" })
  ownerUserId!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  description!: string | null;

  @ApiProperty({ type: "object", additionalProperties: true })
  settings!: Record<string, unknown>;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class WorkspaceMembershipDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ enum: ["owner", "admin", "developer", "viewer"] })
  role!: "owner" | "admin" | "developer" | "viewer";

  @ApiProperty({ type: WorkspaceDto })
  workspace!: WorkspaceDto;
}

export class WorkspaceContextDto {
  @ApiProperty({ type: WorkspaceDto })
  activeWorkspace!: WorkspaceDto;

  @ApiProperty({ type: WorkspaceMembershipDto, isArray: true })
  memberships!: WorkspaceMembershipDto[];
}

export class WorkspaceMemberDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ format: "uuid" })
  workspaceId!: string;

  @ApiProperty({ format: "uuid" })
  userId!: string;

  @ApiProperty({ enum: ["owner", "admin", "developer", "viewer"] })
  role!: "owner" | "admin" | "developer" | "viewer";

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class WorkspaceInvitationDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ format: "uuid" })
  workspaceId!: string;

  @ApiProperty()
  email!: string;

  @ApiProperty({ enum: ["admin", "developer", "viewer"] })
  role!: "admin" | "developer" | "viewer";

  @ApiProperty({ format: "uuid" })
  invitedByUserId!: string;

  @ApiProperty({ enum: ["pending", "accepted", "revoked", "expired"] })
  status!: "pending" | "accepted" | "revoked" | "expired";

  @ApiProperty()
  expiresAt!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  acceptedAt!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, format: "uuid" })
  acceptedByUserId!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class CreatedInvitationDto {
  @ApiProperty({ type: WorkspaceInvitationDto })
  invitation!: WorkspaceInvitationDto;

  @ApiProperty({ description: "Plaintext invite token — shown once" })
  token!: string;
}

export class WorkspaceApiKeyDto {
  @ApiProperty({ format: "uuid" })
  id!: string;

  @ApiProperty({ format: "uuid" })
  workspaceId!: string;

  @ApiProperty()
  name!: string;

  @ApiProperty({ description: "Public prefix for display; secret is never returned" })
  keyPrefix!: string;

  @ApiProperty({ format: "uuid" })
  createdByUserId!: string;

  @ApiPropertyOptional({ nullable: true, type: String })
  lastUsedAt!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  expiresAt!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String })
  revokedAt!: string | null;

  @ApiPropertyOptional({ nullable: true, type: String, format: "uuid" })
  revokedByUserId!: string | null;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

export class CreatedApiKeyDto {
  @ApiProperty({ type: WorkspaceApiKeyDto })
  apiKey!: WorkspaceApiKeyDto;

  @ApiProperty({ description: "Plaintext API key — shown once; store securely" })
  token!: string;
}
