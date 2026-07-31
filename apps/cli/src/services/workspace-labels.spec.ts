import { describe, expect, it } from "vitest";

import type { CliWorkspaceMembership } from "../cli-auth-api-client.js";
import {
  findPersonalWorkspace,
  findWorkspaceByRef,
  workspaceDisplayName,
} from "./workspace-labels.js";

function membership(
  partial: Partial<CliWorkspaceMembership> & {
    readonly workspace: CliWorkspaceMembership["workspace"];
  },
): CliWorkspaceMembership {
  return {
    id: partial.id ?? "m1",
    role: partial.role ?? "owner",
    workspace: partial.workspace,
  };
}

describe("workspaceDisplayName", () => {
  it("labels personal workspaces as Personal", () => {
    expect(
      workspaceDisplayName(
        membership({
          workspace: {
            id: "w1",
            name: "user@example.com",
            kind: "personal",
          },
        }),
      ),
    ).toBe("Personal");
  });

  it("keeps shared workspace names", () => {
    expect(
      workspaceDisplayName(
        membership({
          workspace: { id: "w2", name: "Acme", kind: "shared" },
        }),
      ),
    ).toBe("Acme");
  });
});

describe("findWorkspaceByRef", () => {
  const rows = [
    membership({
      workspace: { id: "aaa", name: "user@example.com", kind: "personal" },
    }),
    membership({
      workspace: { id: "bbb", name: "Acme", kind: "shared" },
    }),
  ];

  it("resolves personal alias", () => {
    expect(findWorkspaceByRef(rows, "personal")?.workspace.id).toBe("aaa");
  });

  it("resolves by name", () => {
    expect(findWorkspaceByRef(rows, "Acme")?.workspace.id).toBe("bbb");
  });

  it("resolves by id", () => {
    expect(findWorkspaceByRef(rows, "bbb")?.workspace.id).toBe("bbb");
  });
});

describe("findPersonalWorkspace", () => {
  it("returns the personal membership", () => {
    const rows = [
      membership({ workspace: { id: "s1", name: "Acme", kind: "shared" } }),
      membership({ workspace: { id: "p1", name: "me", kind: "personal" } }),
    ];
    expect(findPersonalWorkspace(rows)?.workspace.id).toBe("p1");
  });
});
