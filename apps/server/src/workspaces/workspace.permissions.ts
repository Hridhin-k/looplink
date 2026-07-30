import type { WorkspaceRole } from "./workspace.types.js";

/**
 * Fine-grained workspace permissions enforced by guards and services.
 */
export type WorkspacePermission =
  | "workspace:read"
  | "workspace:update_settings"
  | "workspace:invite"
  | "workspace:manage_members"
  | "workspace:manage_api_keys"
  | "workspace:delete"
  | "tunnel:create"
  | "inspector:read"
  | "inspector:replay";

const ROLE_PERMISSIONS: Record<WorkspaceRole, ReadonlySet<WorkspacePermission>> = {
  owner: new Set([
    "workspace:read",
    "workspace:update_settings",
    "workspace:invite",
    "workspace:manage_members",
    "workspace:manage_api_keys",
    "workspace:delete",
    "tunnel:create",
    "inspector:read",
    "inspector:replay",
  ]),
  admin: new Set([
    "workspace:read",
    "workspace:update_settings",
    "workspace:invite",
    "workspace:manage_members",
    "workspace:manage_api_keys",
    "tunnel:create",
    "inspector:read",
    "inspector:replay",
  ]),
  developer: new Set([
    "workspace:read",
    "tunnel:create",
    "inspector:read",
    "inspector:replay",
  ]),
  viewer: new Set(["workspace:read", "inspector:read"]),
};

/**
 * Returns whether a role includes the given permission.
 */
export function roleHasPermission(role: WorkspaceRole, permission: WorkspacePermission): boolean {
  return ROLE_PERMISSIONS[role].has(permission);
}

/**
 * Permissions granted to workspace-scoped API keys (CI / automation).
 *
 * Keys cannot manage members, settings, or other keys.
 */
export const API_KEY_PERMISSIONS: ReadonlySet<WorkspacePermission> = new Set([
  "workspace:read",
  "tunnel:create",
  "inspector:read",
  "inspector:replay",
]);

export function apiKeyHasPermission(permission: WorkspacePermission): boolean {
  return API_KEY_PERMISSIONS.has(permission);
}
