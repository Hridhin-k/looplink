import Table from "cli-table3";

import type { CliWorkspaceMembership } from "../../services/cli-auth-api-client.js";
import { workspaceDisplayName } from "../../services/workspace-labels.js";
import { theme } from "../theme.js";

/**
 * Renders a workspace membership table; highlights the active row.
 */
export function formatWorkspaceTable(
  memberships: readonly CliWorkspaceMembership[],
  activeWorkspaceId: string | undefined,
): string {
  const table = new Table({
    head: [theme.label("Name"), theme.label("Role"), theme.label("Kind")],
    style: { head: [], border: [] },
    chars: {
      mid: "",
      "left-mid": "",
      "mid-mid": "",
      "right-mid": "",
      middle: " ",
      top: "",
      "top-mid": "",
      "top-left": "",
      "top-right": "",
      bottom: "",
      "bottom-mid": "",
      "bottom-left": "",
      "bottom-right": "",
      left: "",
      right: "",
    },
  });

  for (const row of memberships) {
    const name = workspaceDisplayName(row);
    const active = row.workspace.id === activeWorkspaceId;
    const displayName = active ? theme.highlight(`● ${name}`) : `  ${name}`;
    const role = active ? theme.highlight(row.role) : row.role;
    const kind = active ? theme.highlight(row.workspace.kind) : theme.muted(row.workspace.kind);
    table.push([displayName, role, kind]);
  }

  return table.toString();
}

/**
 * Hint text under a workspace name in pickers.
 */
export function workspacePickerHint(row: CliWorkspaceMembership): string {
  if (row.workspace.kind === "personal") {
    return "Your private workspace";
  }
  const role = row.role.charAt(0).toUpperCase() + row.role.slice(1);
  return role;
}
