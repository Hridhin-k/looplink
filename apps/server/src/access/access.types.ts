/**
 * Badger Account — human identity (never owns tunnels/traffic/keys).
 *
 * Resources belong to Workspaces; Membership authorizes access.
 */
export interface Account {
  readonly id: string;
  readonly email: string | null;
  readonly displayName: string | null;
  readonly avatarUrl: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type MembershipStatus = "active" | "invited" | "suspended" | "left";

/**
 * Authorized request scope resolved server-side for every business call.
 *
 * JWT identifies only the Account. Workspace + membership + permissions are
 * derived from Membership and must never be trusted from the client alone.
 */
export interface RequestContext {
  readonly accountId: string;
  readonly accountEmail: string | null;
  readonly authMethod: "jwt" | "api_key";
  readonly workspaceId: string;
  readonly membershipId: string | null;
  readonly role: import("../workspaces/workspace.types.js").WorkspaceRole;
  readonly permissions: ReadonlySet<
    import("../workspaces/workspace.permissions.js").WorkspacePermission
  >;
  readonly apiKeyId?: string;
}

/**
 * Workspace-scoped authorization bundle for business services.
 */
export interface AuthorizedWorkspaceContext {
  readonly request: RequestContext;
  readonly workspace: import("../workspaces/workspace.types.js").Workspace;
}
