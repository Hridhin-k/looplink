import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from "@nestjs/common";

import type { AuthUser } from "../auth/auth.types.js";
import { generateInvitationToken, hashSecret } from "./workspace-crypto.js";
import { roleHasPermission, type WorkspacePermission } from "./workspace.permissions.js";
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
    return this.workspaces.createSharedWorkspace(user.id, normalized);
  }

  async resolveContext(user: AuthUser, requestedWorkspaceId: string | undefined): Promise<WorkspaceContext> {
    if (user.authMethod === "api_key" && user.workspaceId) {
      const workspace = await this.workspaces.findWorkspaceById(user.workspaceId);
      if (workspace === undefined) {
        throw new NotFoundException("Workspace not found for API key.");
      }
      if (requestedWorkspaceId && requestedWorkspaceId !== workspace.id) {
        throw new NotFoundException("Workspace not found for current credentials.");
      }
      return { activeWorkspace: workspace, memberships: [] };
    }

    const memberships = await this.workspaces.listMembershipsForUser(user.id);
    if (memberships.length === 0) {
      throw new NotFoundException("No workspaces found for current user.");
    }

    const requested = requestedWorkspaceId?.trim();
    if (requested && requested.length > 0) {
      const active = memberships.find((m) => m.workspace.id === requested);
      if (!active) {
        throw new NotFoundException("Workspace not found for current user.");
      }
      return { activeWorkspace: active.workspace, memberships };
    }

    const personal = memberships.find((m) => m.workspace.kind === "personal");
    const fallback = memberships[0];
    if (fallback === undefined) {
      throw new NotFoundException("No workspaces found for current user.");
    }
    return { activeWorkspace: (personal ?? fallback).workspace, memberships };
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
    if (!roleHasPermission(member.role, permission)) {
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
        role: existing.role,
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
      role: member.role,
      createdAt: member.createdAt,
      updatedAt: member.updatedAt,
      workspace,
    };
  }

  private rejectApiKeyMutation(user: AuthUser): void {
    if (user.authMethod === "api_key") {
      throw new ForbiddenException("This action requires a user session, not an API key.");
    }
  }
}
