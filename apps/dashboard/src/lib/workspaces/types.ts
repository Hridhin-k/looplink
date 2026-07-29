export type WorkspaceKind = "personal" | "shared";

export type WorkspaceRole = "owner" | "admin" | "developer" | "viewer";

export type InviteRole = "admin" | "developer" | "viewer";

export interface Workspace {
  readonly id: string;
  readonly name: string;
  readonly kind: WorkspaceKind;
  readonly ownerUserId: string;
  readonly description: string | null;
  readonly settings: Record<string, unknown>;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface WorkspaceMembership {
  readonly id: string;
  readonly role: WorkspaceRole;
  readonly workspace: Workspace;
}

export interface WorkspaceContextResponse {
  readonly activeWorkspace: Workspace;
  readonly memberships: WorkspaceMembership[];
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
  readonly status: "pending" | "accepted" | "revoked" | "expired";
  readonly expiresAt: string;
  readonly acceptedAt: string | null;
  readonly acceptedByUserId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreatedInvitation {
  readonly invitation: WorkspaceInvitation;
  readonly token: string;
}

export interface WorkspaceApiKey {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly keyPrefix: string;
  readonly createdByUserId: string;
  readonly lastUsedAt: string | null;
  readonly expiresAt: string | null;
  readonly revokedAt: string | null;
  readonly revokedByUserId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreatedApiKey {
  readonly apiKey: WorkspaceApiKey;
  readonly token: string;
}
