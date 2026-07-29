import type {
  InviteRole,
  Workspace,
  WorkspaceInvitation,
  WorkspaceMember,
  WorkspaceMembership,
  WorkspaceRole,
  WorkspaceSettings,
} from "../workspace.types.js";

export interface CreateInvitationInput {
  readonly workspaceId: string;
  readonly email: string;
  readonly role: InviteRole;
  readonly tokenHash: string;
  readonly invitedByUserId: string;
  readonly expiresAt: string;
}

export interface UpdateWorkspaceInput {
  readonly name?: string;
  readonly description?: string | null;
  readonly settings?: WorkspaceSettings;
}

export interface WorkspaceRepository {
  listMembershipsForUser(userId: string): Promise<WorkspaceMembership[]>;
  createSharedWorkspace(userId: string, name: string): Promise<Workspace>;
  findPersonalWorkspaceForUser(userId: string): Promise<Workspace | undefined>;
  findWorkspaceById(workspaceId: string): Promise<Workspace | undefined>;
  isWorkspaceMember(workspaceId: string, userId: string): Promise<boolean>;
  findMembership(workspaceId: string, userId: string): Promise<WorkspaceMember | undefined>;
  listMembers(workspaceId: string): Promise<WorkspaceMember[]>;
  updateMemberRole(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
  ): Promise<WorkspaceMember>;
  removeMember(workspaceId: string, userId: string): Promise<void>;
  addMember(workspaceId: string, userId: string, role: WorkspaceRole): Promise<WorkspaceMember>;
  updateWorkspace(workspaceId: string, input: UpdateWorkspaceInput): Promise<Workspace>;
  createInvitation(input: CreateInvitationInput): Promise<WorkspaceInvitation>;
  listInvitations(workspaceId: string): Promise<WorkspaceInvitation[]>;
  findInvitationByTokenHash(tokenHash: string): Promise<WorkspaceInvitation | undefined>;
  findPendingInvitationByEmail(
    workspaceId: string,
    email: string,
  ): Promise<WorkspaceInvitation | undefined>;
  updateInvitation(
    invitationId: string,
    patch: {
      readonly status?: string;
      readonly acceptedAt?: string;
      readonly acceptedByUserId?: string;
    },
  ): Promise<WorkspaceInvitation>;
}
