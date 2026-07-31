import type { CliWorkspaceMembership } from "../services/cli-auth-api-client.js";

/**
 * Display label for a workspace in CLI menus and status output.
 *
 * Personal workspaces always show as "Personal" so the menu matches product language.
 */
export function workspaceDisplayName(membership: CliWorkspaceMembership): string {
  if (membership.workspace.kind === "personal") {
    return "Personal";
  }
  return membership.workspace.name;
}

/**
 * Finds the personal workspace membership, if any.
 */
export function findPersonalWorkspace(
  memberships: readonly CliWorkspaceMembership[],
): CliWorkspaceMembership | undefined {
  return memberships.find((row) => row.workspace.kind === "personal");
}

/**
 * Resolves a workspace id or name against the membership list.
 */
export function findWorkspaceByRef(
  memberships: readonly CliWorkspaceMembership[],
  workspaceRef: string,
): CliWorkspaceMembership | undefined {
  const needle = workspaceRef.trim().toLowerCase();
  if (needle.length === 0) {
    return undefined;
  }

  if (needle === "personal") {
    return findPersonalWorkspace(memberships);
  }

  const byId = memberships.find((row) => row.workspace.id.toLowerCase() === needle);
  if (byId !== undefined) {
    return byId;
  }

  const byName = memberships.filter((row) => row.workspace.name.toLowerCase() === needle);
  if (byName.length === 1) {
    return byName[0];
  }
  if (byName.length > 1) {
    throw new Error(
      `Multiple workspaces named "${workspaceRef}". Pass the workspace id instead.`,
    );
  }

  return undefined;
}
