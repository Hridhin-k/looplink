import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import { AuditService } from "../audit/audit.service.js";
import type { AuthUser } from "../auth/auth.types.js";
import { PermissionService } from "../access/permission.service.js";
import { WorkspaceContextService } from "../access/workspace-context.service.js";
import { generateInvitationToken, hashSecret } from "./workspace-crypto.js";
import type { WorkspacePermission } from "./workspace.permissions.js";
import type { WorkspaceRepository } from "./repositories/workspace.repository.js";
import { WORKSPACE_REPOSITORY } from "./workspace.tokens.js";
import type {
  CreatedInvitation,
  InviteRole,
  Workspace,
  WorkspaceInvitation,
  WorkspaceMember,
  WorkspaceMembership,
  WorkspaceRole,
  WorkspaceSettings,
} from "./workspace.types.js";

export interface WorkspaceContext {
  readonly activeWorkspace: Workspace;
  readonly memberships: WorkspaceMembership[];
}

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const INVITE_ROLES: ReadonlySet<InviteRole> = new Set(["admin", "developer", "viewer"]);
const ASSIGNABLE_ROLES: ReadonlySet<WorkspaceRole> = new Set(["admin", "developer", "viewer"]);

@Injectable()
export class WorkspaceService {
  constructor(
    @Inject(WORKSPACE_REPOSITORY)
    private readonly workspaces: WorkspaceRepository,
    private readonly audit: AuditService,
    private readonly workspaceContext: WorkspaceContextService,
    private readonly permissionService: PermissionService,
  ) {}

  async listForUser(user: AuthUser): Promise<WorkspaceMembership[]> {
    return this.workspaces.listMembershipsForUser(user.id);
  }

  async createSharedWorkspace(user: AuthUser, name: string): Promise<Workspace> {
    this.rejectApiKeyMutation(user);
    const normalized = name.trim();
    if (normalized.length < 2) {
      throw new BadRequestException("Workspace name must be at least 2 characters.");
    }
    const workspace = await this.workspaces.createSharedWorkspace(user.id, normalized);
    await this.audit.record({
      actorUserId: user.id,
      workspaceId: workspace.id,
      action: "workspace.created",
      resourceType: "workspace",
      resourceId: workspace.id,
      metadata: { name: workspace.name },
    });
    return workspace;
  }

  /**
   * Resolves active workspace via Membership (Account → Membership → Workspace).
   */
  async resolveContext(
    user: AuthUser,
    requestedWorkspaceId: string | undefined,
  ): Promise<WorkspaceContext> {
    const authorized = await this.workspaceContext.resolve(user, requestedWorkspaceId);
    const memberships =
      user.authMethod === "api_key" ? [] : await this.workspaces.listMembershipsForUser(user.id);
    return {
      activeWorkspace: authorized.workspace,
      memberships,
    };
  }

  async getWorkspace(workspaceId: string): Promise<Workspace> {
    const workspace = await this.workspaces.findWorkspaceById(workspaceId);
    if (workspace === undefined) {
      throw new NotFoundException("Workspace not found.");
    }
    return workspace;
  }

  async requireMembership(workspaceId: string, userId: string): Promise<WorkspaceMember> {
    const member = await this.workspaces.findMembership(workspaceId, userId);
    if (member === undefined) {
      throw new ForbiddenException("Not a member of this workspace.");
    }
    return member;
  }

  async assertPermission(
    workspaceId: string,
    userId: string,
    permission: WorkspacePermission,
  ): Promise<WorkspaceMember> {
    const member = await this.requireMembership(workspaceId, userId);
    const ctxPermissions = this.permissionService.permissionsForRole(member.role);
    if (!ctxPermissions.has(permission)) {
      throw new ForbiddenException("Insufficient workspace permissions.");
    }
    return member;
  }

  async updateSettings(
    user: AuthUser,
    workspaceId: string,
    input: {
      readonly name?: string;
      readonly description?: string | null;
      readonly settings?: WorkspaceSettings;
    },
  ): Promise<Workspace> {
    this.rejectApiKeyMutation(user);
    await this.assertPermission(workspaceId, user.id, "workspace:update_settings");

    const patch: {
      name?: string;
      description?: string | null;
      settings?: WorkspaceSettings;
    } = {};

    if (input.name !== undefined) {
      const normalized = input.name.trim();
      if (normalized.length < 2) {
        throw new BadRequestException("Workspace name must be at least 2 characters.");
      }
      patch.name = normalized;
    }
    if (input.description !== undefined) {
      patch.description =
        input.description === null ? null : input.description.trim().slice(0, 2000);
    }
    if (input.settings !== undefined) {
      patch.settings = input.settings;
    }

    return this.workspaces.updateWorkspace(workspaceId, patch);
  }

  /**
   * Soft-deletes a shared workspace. Personal workspaces cannot be deleted.
   * Authorization is Membership role `owner` via PermissionService — never owner_user_id.
   */
  async deleteWorkspace(
    user: AuthUser,
    workspaceId: string,
    confirmationName: string,
  ): Promise<void> {
    this.rejectApiKeyMutation(user);
    const member = await this.assertPermission(workspaceId, user.id, "workspace:delete");
    if (member.role !== "owner") {
      throw new ForbiddenException("Only the workspace owner can delete it.");
    }

    const workspace = await this.getWorkspace(workspaceId);
    if (workspace.kind === "personal") {
      throw new ForbiddenException("Personal workspaces cannot be deleted.");
    }
    if (confirmationName.trim() !== workspace.name) {
      throw new BadRequestException("Confirmation name does not match the workspace name.");
    }

    await this.workspaces.softDeleteWorkspace(workspaceId);
    await this.audit.record({
      actorUserId: user.id,
      workspaceId: workspace.id,
      action: "workspace.deleted",
      resourceType: "workspace",
      resourceId: workspace.id,
      metadata: { name: workspace.name },
    });
  }

  /**
   * Leaves a shared workspace (marks membership `left`). Personal workspaces cannot be left.
   */
  async leaveWorkspace(user: AuthUser, workspaceId: string): Promise<void> {
    this.rejectApiKeyMutation(user);
    const workspace = await this.getWorkspace(workspaceId);
    if (workspace.kind === "personal") {
      throw new ForbiddenException("Cannot leave a personal workspace.");
    }
    const member = await this.requireMembership(workspaceId, user.id);
    if (member.role === "owner") {
      throw new ForbiddenException("Owners must transfer ownership before leaving.");
    }
    await this.workspaces.setMemberStatus(workspaceId, user.id, "left");
    await this.audit.record({
      actorUserId: user.id,
      workspaceId,
      action: "workspace.member.left",
      resourceType: "membership",
      resourceId: member.id,
    });
  }

  /**
   * Transfers ownership via Membership roles (never JWT claims).
   */
  async transferOwnership(
    actor: AuthUser,
    workspaceId: string,
    targetAccountId: string,
  ): Promise<void> {
    this.rejectApiKeyMutation(actor);
    const actorMember = await this.assertPermission(
      workspaceId,
      actor.id,
      "workspace:manage_members",
    );
    if (actorMember.role !== "owner") {
      throw new ForbiddenException("Only the workspace owner can transfer ownership.");
    }
    if (targetAccountId === actor.id) {
      throw new BadRequestException("Cannot transfer ownership to yourself.");
    }

    const target = await this.workspaces.findMembership(workspaceId, targetAccountId);
    if (target === undefined) {
      throw new NotFoundException("Target account is not an active member.");
    }

    await this.workspaces.updateMemberRole(workspaceId, targetAccountId, "owner");
    await this.workspaces.updateMemberRole(workspaceId, actor.id, "admin");
    await this.audit.record({
      actorUserId: actor.id,
      workspaceId,
      action: "workspace.ownership.transferred",
      resourceType: "workspace",
      resourceId: workspaceId,
      metadata: { fromAccountId: actor.id, toAccountId: targetAccountId },
    });
  }

  async listMembers(user: AuthUser, workspaceId: string): Promise<WorkspaceMember[]> {
    if (user.authMethod === "api_key") {
      if (user.workspaceId !== workspaceId) {
        throw new ForbiddenException("API key is not valid for this workspace.");
      }
      return this.workspaces.listMembers(workspaceId);
    }
    await this.assertPermission(workspaceId, user.id, "workspace:read");
    return this.workspaces.listMembers(workspaceId);
  }

  async updateMemberRole(
    actor: AuthUser,
    workspaceId: string,
    targetUserId: string,
    role: WorkspaceRole,
  ): Promise<WorkspaceMember> {
    this.rejectApiKeyMutation(actor);
    const actorMember = await this.assertPermission(
      workspaceId,
      actor.id,
      "workspace:manage_members",
    );

    if (!ASSIGNABLE_ROLES.has(role)) {
      throw new BadRequestException("Role must be admin, developer, or viewer.");
    }

    const target = await this.workspaces.findMembership(workspaceId, targetUserId);
    if (target === undefined) {
      throw new NotFoundException("Member not found.");
    }
    if (target.role === "owner") {
      throw new ForbiddenException("Cannot change the owner role.");
    }
    if (actorMember.role === "admin" && target.role === "admin" && actor.id !== targetUserId) {
      throw new ForbiddenException("Admins cannot change other admins.");
    }
    if (targetUserId === actor.id && role !== actorMember.role) {
      throw new ForbiddenException("Cannot change your own role.");
    }

    return this.workspaces.updateMemberRole(workspaceId, targetUserId, role);
  }

  async removeMember(actor: AuthUser, workspaceId: string, targetUserId: string): Promise<void> {
    this.rejectApiKeyMutation(actor);
    const actorMember = await this.assertPermission(
      workspaceId,
      actor.id,
      "workspace:manage_members",
    );

    const target = await this.workspaces.findMembership(workspaceId, targetUserId);
    if (target === undefined) {
      throw new NotFoundException("Member not found.");
    }
    if (target.role === "owner") {
      throw new ForbiddenException("Cannot remove the workspace owner.");
    }
    if (actorMember.role === "admin" && target.role === "admin") {
      throw new ForbiddenException("Admins cannot remove other admins.");
    }
    if (targetUserId === actor.id) {
      throw new BadRequestException("Use leave workspace instead of removing yourself.");
    }

    await this.workspaces.removeMember(workspaceId, targetUserId);
  }

  async inviteMember(
    actor: AuthUser,
    workspaceId: string,
    email: string,
    role: InviteRole,
  ): Promise<CreatedInvitation> {
    this.rejectApiKeyMutation(actor);
    await this.assertPermission(workspaceId, actor.id, "workspace:invite");

    if (!INVITE_ROLES.has(role)) {
      throw new BadRequestException("Invite role must be admin, developer, or viewer.");
    }

    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail.includes("@")) {
      throw new BadRequestException("A valid email is required.");
    }

    const existingPending = await this.workspaces.findPendingInvitationByEmail(
      workspaceId,
      normalizedEmail,
    );
    if (existingPending !== undefined) {
      throw new ConflictException("A pending invitation already exists for this email.");
    }

    const token = generateInvitationToken();
    const invitation = await this.workspaces.createInvitation({
      workspaceId,
      email: normalizedEmail,
      role,
      tokenHash: hashSecret(token),
      invitedByUserId: actor.id,
      expiresAt: new Date(Date.now() + INVITE_TTL_MS).toISOString(),
    });

    return { invitation, token };
  }

  async listInvitations(actor: AuthUser, workspaceId: string): Promise<WorkspaceInvitation[]> {
    this.rejectApiKeyMutation(actor);
    await this.assertPermission(workspaceId, actor.id, "workspace:invite");
    return this.workspaces.listInvitations(workspaceId);
  }

  async revokeInvitation(
    actor: AuthUser,
    workspaceId: string,
    invitationId: string,
  ): Promise<WorkspaceInvitation> {
    this.rejectApiKeyMutation(actor);
    await this.assertPermission(workspaceId, actor.id, "workspace:invite");

    const invitations = await this.workspaces.listInvitations(workspaceId);
    const invitation = invitations.find((row) => row.id === invitationId);
    if (invitation === undefined) {
      throw new NotFoundException("Invitation not found.");
    }
    if (invitation.status !== "pending") {
      throw new BadRequestException("Only pending invitations can be revoked.");
    }
    return this.workspaces.updateInvitation(invitationId, { status: "revoked" });
  }

  async acceptInvitation(user: AuthUser, token: string): Promise<WorkspaceMembership> {
    this.rejectApiKeyMutation(user);
    const normalizedToken = token.trim();
    if (normalizedToken.length === 0) {
      throw new BadRequestException("Invitation token is required.");
    }

    const invitation = await this.workspaces.findInvitationByTokenHash(hashSecret(normalizedToken));
    if (invitation === undefined) {
      throw new NotFoundException("Invitation not found.");
    }
    if (invitation.status !== "pending") {
      throw new BadRequestException("Invitation is no longer pending.");
    }
    if (new Date(invitation.expiresAt).getTime() < Date.now()) {
      await this.workspaces.updateInvitation(invitation.id, { status: "expired" });
      throw new BadRequestException("Invitation has expired.");
    }

    const userEmail = user.email?.trim().toLowerCase();
    if (userEmail === undefined || userEmail !== invitation.email.toLowerCase()) {
      throw new ForbiddenException("Signed-in email does not match the invitation.");
    }

    const existing = await this.workspaces.findMembership(invitation.workspaceId, user.id);
    if (existing !== undefined) {
      await this.workspaces.updateInvitation(invitation.id, {
        status: "accepted",
        acceptedAt: new Date().toISOString(),
        acceptedByUserId: user.id,
      });
      const workspace = await this.getWorkspace(invitation.workspaceId);
      return {
        id: existing.id,
        workspaceId: existing.workspaceId,
        userId: existing.userId,
        accountId: existing.accountId,
        role: existing.role,
        status: existing.status,
        joinedAt: existing.joinedAt,
        createdAt: existing.createdAt,
        updatedAt: existing.updatedAt,
        workspace,
      };
    }

    const member = await this.workspaces.addMember(
      invitation.workspaceId,
      user.id,
      invitation.role,
    );
    await this.workspaces.updateInvitation(invitation.id, {
      status: "accepted",
      acceptedAt: new Date().toISOString(),
      acceptedByUserId: user.id,
    });

    const workspace = await this.getWorkspace(invitation.workspaceId);
    return {
      id: member.id,
      workspaceId: member.workspaceId,
      userId: member.userId,
      accountId: member.accountId,
      role: member.role,
      status: member.status,
      joinedAt: member.joinedAt,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
      workspace,
    };
  }

  /**
   * Hard-deletes every workspace owned by the user so auth user deletion is not
   * blocked by `workspaces.owner_user_id … ON DELETE RESTRICT`.
   *
   * Includes personal and soft-deleted workspaces. Only for account deletion.
   */
  async purgeOwnedWorkspacesForAccountDeletion(userId: string): Promise<number> {
    const ownedIds = await this.workspaces.listOwnedWorkspaceIds(userId);
    for (const workspaceId of ownedIds) {
      await this.workspaces.hardDeleteWorkspace(workspaceId);
      await this.audit.record({
        actorUserId: userId,
        workspaceId,
        action: "workspace.purged_for_account_deletion",
        resourceType: "workspace",
        resourceId: workspaceId,
      });
    }
    return ownedIds.length;
  }

  private rejectApiKeyMutation(user: AuthUser): void {
    if (user.authMethod === "api_key") {
      throw new ForbiddenException("This action requires a user session, not an API key.");
    }
  }
}
