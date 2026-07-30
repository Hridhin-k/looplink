import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import {
  ApiBearerAuth,
  ApiBody,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from "@nestjs/swagger";

import { CurrentUser } from "../auth/decorators/current-user.decorator.js";
import type { AuthUser } from "../auth/auth.types.js";
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard.js";
import { parseJsonBody, readRequiredString } from "../auth/parse-json-body.js";
import { ApiKeyService } from "./api-keys/api-key.service.js";
import {
  AcceptInvitationBodyDto,
  CreateApiKeyBodyDto,
  InviteMemberBodyDto,
  UpdateMemberRoleBodyDto,
  UpdateWorkspaceBodyDto,
} from "./dto/collaboration-body.dto.js";
import { CreateWorkspaceBodyDto } from "./dto/create-workspace-body.dto.js";
import {
  CreatedApiKeyDto,
  CreatedInvitationDto,
  WorkspaceApiKeyDto,
  WorkspaceContextDto,
  WorkspaceDto,
  WorkspaceInvitationDto,
  WorkspaceMemberDto,
  WorkspaceMembershipDto,
} from "./dto/workspace.dto.js";
import { RequireWorkspacePermission } from "./decorators/require-workspace-permission.decorator.js";
import { WorkspacePermissionGuard } from "./guards/workspace-permission.guard.js";
import type { InviteRole, WorkspaceRole } from "./workspace.types.js";
import { WorkspaceService } from "./workspace.service.js";

@ApiTags("workspaces")
@ApiBearerAuth()
@Controller("api/v1/workspaces")
@UseGuards(JwtAuthGuard)
export class WorkspaceController {
  constructor(
    private readonly workspaceService: WorkspaceService,
    private readonly apiKeys: ApiKeyService,
  ) {}

  @Get()
  @ApiOperation({ summary: "List workspaces for current user" })
  @ApiOkResponse({ type: WorkspaceMembershipDto, isArray: true })
  @ApiUnauthorizedResponse({ description: "Missing or invalid access token" })
  async list(@CurrentUser() user: AuthUser): Promise<WorkspaceMembershipDto[]> {
    const rows = await this.workspaceService.listForUser(user);
    return rows.map((row) => ({
      id: row.id,
      role: row.role,
      workspace: toWorkspaceDto(row.workspace),
    }));
  }

  @Get("context")
  @ApiOperation({ summary: "Resolve active workspace context for current user" })
  @ApiQuery({ name: "workspaceId", required: false })
  @ApiOkResponse({ type: WorkspaceContextDto })
  async context(
    @CurrentUser() user: AuthUser,
    @Query("workspaceId") workspaceId?: string,
  ): Promise<WorkspaceContextDto> {
    const context = await this.workspaceService.resolveContext(user, workspaceId);
    return {
      activeWorkspace: toWorkspaceDto(context.activeWorkspace),
      memberships: context.memberships.map((row) => ({
        id: row.id,
        role: row.role,
        workspace: toWorkspaceDto(row.workspace),
      })),
    };
  }

  @Post()
  @ApiOperation({ summary: "Create a shared workspace" })
  @ApiBody({ type: CreateWorkspaceBodyDto })
  @ApiOkResponse({ type: WorkspaceDto })
  async create(@CurrentUser() user: AuthUser, @Body() body: unknown): Promise<WorkspaceDto> {
    const json = parseJsonBody(body);
    const name = readRequiredString(json, "name");
    const workspace = await this.workspaceService.createSharedWorkspace(user, name);
    return toWorkspaceDto(workspace);
  }

  @Post("invitations/accept")
  @ApiOperation({ summary: "Accept a workspace invitation" })
  @ApiBody({ type: AcceptInvitationBodyDto })
  @ApiOkResponse({ type: WorkspaceMembershipDto })
  async acceptInvitation(
    @CurrentUser() user: AuthUser,
    @Body() body: unknown,
  ): Promise<WorkspaceMembershipDto> {
    const json = parseJsonBody(body);
    const token = readRequiredString(json, "token");
    const membership = await this.workspaceService.acceptInvitation(user, token);
    return {
      id: membership.id,
      role: membership.role,
      workspace: toWorkspaceDto(membership.workspace),
    };
  }

  @Get(":workspaceId")
  @UseGuards(WorkspacePermissionGuard)
  @RequireWorkspacePermission("workspace:read")
  @ApiOperation({ summary: "Get workspace settings" })
  @ApiOkResponse({ type: WorkspaceDto })
  async getOne(@Param("workspaceId") workspaceId: string): Promise<WorkspaceDto> {
    const workspace = await this.workspaceService.getWorkspace(workspaceId);
    return toWorkspaceDto(workspace);
  }

  @Patch(":workspaceId")
  @UseGuards(WorkspacePermissionGuard)
  @RequireWorkspacePermission("workspace:update_settings")
  @ApiOperation({ summary: "Update workspace settings" })
  @ApiBody({ type: UpdateWorkspaceBodyDto })
  @ApiOkResponse({ type: WorkspaceDto })
  async update(
    @CurrentUser() user: AuthUser,
    @Param("workspaceId") workspaceId: string,
    @Body() body: unknown,
  ): Promise<WorkspaceDto> {
    const json = parseJsonBody(body);
    const descriptionValue = json["description"];
    const settingsValue = json["settings"];
    const workspace = await this.workspaceService.updateSettings(user, workspaceId, {
      ...(typeof json["name"] === "string" ? { name: json["name"] } : {}),
      ...(descriptionValue === null || typeof descriptionValue === "string"
        ? { description: descriptionValue }
        : {}),
      ...(typeof settingsValue === "object" &&
      settingsValue !== null &&
      !Array.isArray(settingsValue)
        ? { settings: settingsValue as Record<string, unknown> }
        : {}),
    });
    return toWorkspaceDto(workspace);
  }

  @Delete(":workspaceId")
  @HttpCode(204)
  @UseGuards(WorkspacePermissionGuard)
  @RequireWorkspacePermission("workspace:delete")
  @ApiOperation({
    summary: "Soft-delete a shared workspace (owner only; confirm with exact name)",
  })
  async deleteWorkspace(
    @CurrentUser() user: AuthUser,
    @Param("workspaceId") workspaceId: string,
    @Body() body: unknown,
  ): Promise<void> {
    const json = parseJsonBody(body);
    await this.workspaceService.deleteWorkspace(
      user,
      workspaceId,
      readRequiredString(json, "confirmationName"),
    );
  }

  @Post(":workspaceId/leave")
  @HttpCode(204)
  @UseGuards(WorkspacePermissionGuard)
  @RequireWorkspacePermission("workspace:read")
  @ApiOperation({ summary: "Leave a shared workspace (membership status → left)" })
  async leave(
    @CurrentUser() user: AuthUser,
    @Param("workspaceId") workspaceId: string,
  ): Promise<void> {
    await this.workspaceService.leaveWorkspace(user, workspaceId);
  }

  @Post(":workspaceId/transfer-ownership")
  @HttpCode(204)
  @UseGuards(WorkspacePermissionGuard)
  @RequireWorkspacePermission("workspace:manage_members")
  @ApiOperation({ summary: "Transfer workspace ownership via Membership roles" })
  async transferOwnership(
    @CurrentUser() user: AuthUser,
    @Param("workspaceId") workspaceId: string,
    @Body() body: unknown,
  ): Promise<void> {
    const json = parseJsonBody(body);
    await this.workspaceService.transferOwnership(
      user,
      workspaceId,
      readRequiredString(json, "accountId"),
    );
  }

  @Get(":workspaceId/members")
  @UseGuards(WorkspacePermissionGuard)
  @RequireWorkspacePermission("workspace:read")
  @ApiOperation({ summary: "List workspace members" })
  @ApiOkResponse({ type: WorkspaceMemberDto, isArray: true })
  async listMembers(
    @CurrentUser() user: AuthUser,
    @Param("workspaceId") workspaceId: string,
  ): Promise<WorkspaceMemberDto[]> {
    const members = await this.workspaceService.listMembers(user, workspaceId);
    return members.map(toMemberDto);
  }

  @Patch(":workspaceId/members/:userId")
  @UseGuards(WorkspacePermissionGuard)
  @RequireWorkspacePermission("workspace:manage_members")
  @ApiOperation({ summary: "Update a member role" })
  @ApiBody({ type: UpdateMemberRoleBodyDto })
  @ApiOkResponse({ type: WorkspaceMemberDto })
  async updateMemberRole(
    @CurrentUser() user: AuthUser,
    @Param("workspaceId") workspaceId: string,
    @Param("userId") userId: string,
    @Body() body: unknown,
  ): Promise<WorkspaceMemberDto> {
    const json = parseJsonBody(body);
    const role = readRequiredString(json, "role") as WorkspaceRole;
    const member = await this.workspaceService.updateMemberRole(user, workspaceId, userId, role);
    return toMemberDto(member);
  }

  @Delete(":workspaceId/members/:userId")
  @UseGuards(WorkspacePermissionGuard)
  @RequireWorkspacePermission("workspace:manage_members")
  @ApiOperation({ summary: "Remove a workspace member" })
  @ApiOkResponse({ description: "Member removed" })
  async removeMember(
    @CurrentUser() user: AuthUser,
    @Param("workspaceId") workspaceId: string,
    @Param("userId") userId: string,
  ): Promise<{ ok: true }> {
    await this.workspaceService.removeMember(user, workspaceId, userId);
    return { ok: true };
  }

  @Get(":workspaceId/invitations")
  @UseGuards(WorkspacePermissionGuard)
  @RequireWorkspacePermission("workspace:invite")
  @ApiOperation({ summary: "List workspace invitations" })
  @ApiOkResponse({ type: WorkspaceInvitationDto, isArray: true })
  async listInvitations(
    @CurrentUser() user: AuthUser,
    @Param("workspaceId") workspaceId: string,
  ): Promise<WorkspaceInvitationDto[]> {
    const rows = await this.workspaceService.listInvitations(user, workspaceId);
    return rows.map(toInvitationDto);
  }

  @Post(":workspaceId/invitations")
  @UseGuards(WorkspacePermissionGuard)
  @RequireWorkspacePermission("workspace:invite")
  @ApiOperation({ summary: "Invite a member to the workspace" })
  @ApiBody({ type: InviteMemberBodyDto })
  @ApiOkResponse({ type: CreatedInvitationDto })
  async invite(
    @CurrentUser() user: AuthUser,
    @Param("workspaceId") workspaceId: string,
    @Body() body: unknown,
  ): Promise<CreatedInvitationDto> {
    const json = parseJsonBody(body);
    const email = readRequiredString(json, "email");
    const role = readRequiredString(json, "role") as InviteRole;
    const created = await this.workspaceService.inviteMember(user, workspaceId, email, role);
    return {
      invitation: toInvitationDto(created.invitation),
      token: created.token,
    };
  }

  @Delete(":workspaceId/invitations/:invitationId")
  @UseGuards(WorkspacePermissionGuard)
  @RequireWorkspacePermission("workspace:invite")
  @ApiOperation({ summary: "Revoke a pending invitation" })
  @ApiOkResponse({ type: WorkspaceInvitationDto })
  async revokeInvitation(
    @CurrentUser() user: AuthUser,
    @Param("workspaceId") workspaceId: string,
    @Param("invitationId") invitationId: string,
  ): Promise<WorkspaceInvitationDto> {
    const invitation = await this.workspaceService.revokeInvitation(
      user,
      workspaceId,
      invitationId,
    );
    return toInvitationDto(invitation);
  }

  @Get(":workspaceId/api-keys")
  @UseGuards(WorkspacePermissionGuard)
  @RequireWorkspacePermission("workspace:manage_api_keys")
  @ApiOperation({ summary: "List workspace API keys (metadata only)" })
  @ApiOkResponse({ type: WorkspaceApiKeyDto, isArray: true })
  async listApiKeys(
    @CurrentUser() user: AuthUser,
    @Param("workspaceId") workspaceId: string,
  ): Promise<WorkspaceApiKeyDto[]> {
    const keys = await this.apiKeys.list(user, workspaceId);
    return keys.map(toApiKeyDto);
  }

  @Post(":workspaceId/api-keys")
  @UseGuards(WorkspacePermissionGuard)
  @RequireWorkspacePermission("workspace:manage_api_keys")
  @ApiOperation({ summary: "Create a workspace API key" })
  @ApiBody({ type: CreateApiKeyBodyDto })
  @ApiOkResponse({ type: CreatedApiKeyDto })
  async createApiKey(
    @CurrentUser() user: AuthUser,
    @Param("workspaceId") workspaceId: string,
    @Body() body: unknown,
  ): Promise<CreatedApiKeyDto> {
    const json = parseJsonBody(body);
    const name = readRequiredString(json, "name");
    const expiresAt =
      json["expiresAt"] === null || json["expiresAt"] === undefined
        ? null
        : typeof json["expiresAt"] === "string"
          ? json["expiresAt"]
          : null;
    const created = await this.apiKeys.create(user, workspaceId, name, expiresAt);
    return {
      apiKey: toApiKeyDto(created.apiKey),
      token: created.token,
    };
  }

  @Post(":workspaceId/api-keys/:keyId/rotate")
  @UseGuards(WorkspacePermissionGuard)
  @RequireWorkspacePermission("workspace:manage_api_keys")
  @ApiOperation({ summary: "Rotate a workspace API key" })
  @ApiOkResponse({ type: CreatedApiKeyDto })
  async rotateApiKey(
    @CurrentUser() user: AuthUser,
    @Param("workspaceId") workspaceId: string,
    @Param("keyId") keyId: string,
  ): Promise<CreatedApiKeyDto> {
    const created = await this.apiKeys.rotate(user, workspaceId, keyId);
    return {
      apiKey: toApiKeyDto(created.apiKey),
      token: created.token,
    };
  }

  @Delete(":workspaceId/api-keys/:keyId")
  @UseGuards(WorkspacePermissionGuard)
  @RequireWorkspacePermission("workspace:manage_api_keys")
  @ApiOperation({ summary: "Revoke a workspace API key" })
  @ApiOkResponse({ type: WorkspaceApiKeyDto })
  async revokeApiKey(
    @CurrentUser() user: AuthUser,
    @Param("workspaceId") workspaceId: string,
    @Param("keyId") keyId: string,
  ): Promise<WorkspaceApiKeyDto> {
    const key = await this.apiKeys.revoke(user, workspaceId, keyId);
    return toApiKeyDto(key);
  }
}

function toWorkspaceDto(workspace: {
  id: string;
  name: string;
  kind: "personal" | "shared";
  ownerUserId: string;
  description: string | null;
  settings: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}): WorkspaceDto {
  return { ...workspace };
}

function toMemberDto(member: {
  id: string;
  workspaceId: string;
  userId: string;
  accountId: string;
  role: "owner" | "admin" | "developer" | "viewer";
  status: "active" | "invited" | "suspended" | "left";
  joinedAt: string;
  createdAt: string;
  updatedAt: string;
}): WorkspaceMemberDto {
  return {
    id: member.id,
    workspaceId: member.workspaceId,
    userId: member.userId,
    role: member.role,
    createdAt: member.createdAt,
    updatedAt: member.updatedAt,
  };
}

function toInvitationDto(invitation: {
  id: string;
  workspaceId: string;
  email: string;
  role: "admin" | "developer" | "viewer";
  invitedByUserId: string;
  status: "pending" | "accepted" | "revoked" | "expired";
  expiresAt: string;
  acceptedAt: string | null;
  acceptedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}): WorkspaceInvitationDto {
  return { ...invitation };
}

function toApiKeyDto(key: {
  id: string;
  workspaceId: string;
  name: string;
  keyPrefix: string;
  createdByUserId: string;
  lastUsedAt: string | null;
  expiresAt: string | null;
  revokedAt: string | null;
  revokedByUserId: string | null;
  createdAt: string;
  updatedAt: string;
}): WorkspaceApiKeyDto {
  return { ...key };
}
