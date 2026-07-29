export type WorkspaceKind = "personal" | "shared";

export type WorkspaceRole = "owner" | "admin" | "developer" | "viewer";

export type InviteRole = "admin" | "developer" | "viewer";

export type InvitationStatus = "pending" | "accepted" | "revoked" | "expired";

export type WorkspaceSettings = Record<string, unknown>;

export interface Workspace {
  readonly id: string;
  readonly name: string;
  readonly kind: WorkspaceKind;
  readonly ownerUserId: string;
  readonly description: string | null;
  readonly settings: WorkspaceSettings;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface WorkspaceMembership {
  readonly id: string;
  readonly workspaceId: string;
  readonly userId: string;
  readonly role: WorkspaceRole;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly workspace: Workspace;
}

export interface WorkspaceMember {
  readonly id: string;
  readonly workspaceId: string;
  readonly userId: string;
  readonly role: WorkspaceRole;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface WorkspaceInvitation {
  readonly id: string;
  readonly workspaceId: string;
  readonly email: string;
  readonly role: InviteRole;
  readonly invitedByUserId: string;
  readonly status: InvitationStatus;
  readonly expiresAt: string;
  readonly acceptedAt: string | null;
  readonly acceptedByUserId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreatedInvitation {
  readonly invitation: WorkspaceInvitation;
  /** Plaintext token — returned once for the inviter to share. */
  readonly token: string;
}
