import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";

import { SUPABASE_CONFIG } from "../../database/database.tokens.js";
import type { SupabaseConfig } from "../../database/supabase.config.js";
import type {
  InviteRole,
  InvitationStatus,
  MembershipStatus,
  Workspace,
  WorkspaceInvitation,
  WorkspaceMember,
  WorkspaceMembership,
  WorkspaceRole,
  WorkspaceSettings,
} from "../workspace.types.js";
import type {
  CreateInvitationInput,
  UpdateWorkspaceInput,
  WorkspaceRepository,
} from "./workspace.repository.js";

interface WorkspaceRow {
  id: string;
  name: string;
  owner_user_id: string;
  is_personal: boolean;
  description: string | null;
  settings: WorkspaceSettings | null;
  deleted_at: string | null;
  created_at: string;
  updated_at: string;
}

interface MembershipRow {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  status: string | null;
  joined_at: string | null;
  created_at: string;
  updated_at: string;
  workspaces: WorkspaceRow | null;
}

interface MemberRow {
  id: string;
  workspace_id: string;
  user_id: string;
  role: WorkspaceRole;
  status: string | null;
  joined_at: string | null;
  created_at: string;
  updated_at: string;
}

interface InvitationRow {
  id: string;
  workspace_id: string;
  email: string;
  role: InviteRole;
  invited_by_user_id: string;
  status: InvitationStatus;
  expires_at: string;
  accepted_at: string | null;
  accepted_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

const WORKSPACE_SELECT =
  "id,name,owner_user_id,is_personal,description,settings,deleted_at,created_at,updated_at";

const ACTIVE_WORKSPACE_FILTER = "deleted_at=is.null";

@Injectable()
export class SupabaseWorkspaceRepository implements WorkspaceRepository {
  constructor(
    @Inject(SUPABASE_CONFIG)
    private readonly config: SupabaseConfig,
  ) {}

  async listMembershipsForUser(userId: string): Promise<WorkspaceMembership[]> {
    const encodedUserId = encodeURIComponent(userId);
    const rows = await this.requestJson<MembershipRow[]>(
      "GET",
      `/rest/v1/workspace_members?select=id,workspace_id,user_id,role,status,joined_at,created_at,updated_at,workspaces(${WORKSPACE_SELECT})&user_id=eq.${encodedUserId}&status=eq.active&order=created_at.asc`,
    );

    return rows.flatMap((row) => {
      const workspace = row.workspaces;
      if (workspace === null || workspace.deleted_at !== null) {
        return [];
      }
      return [
        {
          id: row.id,
          workspaceId: row.workspace_id,
          userId: row.user_id,
          accountId: row.user_id,
          role: normalizeRole(row.role),
          status: normalizeStatus(row.status),
          joinedAt: row.joined_at ?? row.created_at,
          createdAt: row.created_at,
          updatedAt: row.updated_at,
          workspace: mapWorkspace(workspace),
        },
      ];
    });
  }

  async createSharedWorkspace(userId: string, name: string): Promise<Workspace> {
    const created = await this.requestJson<WorkspaceRow[]>(
      "POST",
      "/rest/v1/workspaces",
      { name, owner_user_id: userId, is_personal: false },
      { prefer: "return=representation" },
    );
    const workspaceRow = created[0];
    if (workspaceRow === undefined) {
      throw new Error("Failed to create workspace: no row returned.");
    }

    await this.requestJson(
      "POST",
      "/rest/v1/workspace_members",
      { workspace_id: workspaceRow.id, user_id: userId, role: "owner", status: "active" },
      { prefer: "return=minimal" },
    );

    return mapWorkspace(workspaceRow);
  }

  async findPersonalWorkspaceForUser(userId: string): Promise<Workspace | undefined> {
    const encodedUserId = encodeURIComponent(userId);
    const rows = await this.requestJson<WorkspaceRow[]>(
      "GET",
      `/rest/v1/workspaces?select=${WORKSPACE_SELECT}&owner_user_id=eq.${encodedUserId}&is_personal=eq.true&${ACTIVE_WORKSPACE_FILTER}&limit=1`,
    );
    const row = rows[0];
    if (row === undefined) {
      return undefined;
    }
    return mapWorkspace(row);
  }

  async findWorkspaceById(workspaceId: string): Promise<Workspace | undefined> {
    const encoded = encodeURIComponent(workspaceId);
    const rows = await this.requestJson<WorkspaceRow[]>(
      "GET",
      `/rest/v1/workspaces?select=${WORKSPACE_SELECT}&id=eq.${encoded}&${ACTIVE_WORKSPACE_FILTER}&limit=1`,
    );
    const row = rows[0];
    return row === undefined ? undefined : mapWorkspace(row);
  }

  async isWorkspaceMember(workspaceId: string, userId: string): Promise<boolean> {
    const membership = await this.findMembership(workspaceId, userId);
    return membership !== undefined;
  }

  async findMembership(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMember | undefined> {
    const encodedWorkspaceId = encodeURIComponent(workspaceId);
    const encodedUserId = encodeURIComponent(userId);
    const rows = await this.requestJson<MemberRow[]>(
      "GET",
      `/rest/v1/workspace_members?select=id,workspace_id,user_id,role,status,joined_at,created_at,updated_at&workspace_id=eq.${encodedWorkspaceId}&user_id=eq.${encodedUserId}&status=eq.active&limit=1`,
    );
    const row = rows[0];
    return row === undefined ? undefined : mapMember(row);
  }

  async listMembers(workspaceId: string): Promise<WorkspaceMember[]> {
    const encoded = encodeURIComponent(workspaceId);
    const rows = await this.requestJson<MemberRow[]>(
      "GET",
      `/rest/v1/workspace_members?select=id,workspace_id,user_id,role,status,joined_at,created_at,updated_at&workspace_id=eq.${encoded}&status=eq.active&order=created_at.asc`,
    );
    return rows.map(mapMember);
  }

  async updateMemberRole(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
  ): Promise<WorkspaceMember> {
    const encodedWorkspaceId = encodeURIComponent(workspaceId);
    const encodedUserId = encodeURIComponent(userId);
    const rows = await this.requestJson<MemberRow[]>(
      "PATCH",
      `/rest/v1/workspace_members?workspace_id=eq.${encodedWorkspaceId}&user_id=eq.${encodedUserId}`,
      { role },
      { prefer: "return=representation" },
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error("Failed to update member role.");
    }
    return mapMember(row);
  }

  async setMemberStatus(
    workspaceId: string,
    userId: string,
    status: MembershipStatus,
  ): Promise<WorkspaceMember> {
    const encodedWorkspaceId = encodeURIComponent(workspaceId);
    const encodedUserId = encodeURIComponent(userId);
    const rows = await this.requestJson<MemberRow[]>(
      "PATCH",
      `/rest/v1/workspace_members?workspace_id=eq.${encodedWorkspaceId}&user_id=eq.${encodedUserId}`,
      { status },
      { prefer: "return=representation" },
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error("Failed to update membership status.");
    }
    return mapMember(row);
  }

  async removeMember(workspaceId: string, userId: string): Promise<void> {
    const encodedWorkspaceId = encodeURIComponent(workspaceId);
    const encodedUserId = encodeURIComponent(userId);
    await this.requestJson(
      "DELETE",
      `/rest/v1/workspace_members?workspace_id=eq.${encodedWorkspaceId}&user_id=eq.${encodedUserId}`,
      undefined,
      { prefer: "return=minimal" },
    );
  }

  async addMember(
    workspaceId: string,
    userId: string,
    role: WorkspaceRole,
  ): Promise<WorkspaceMember> {
    const rows = await this.requestJson<MemberRow[]>(
      "POST",
      "/rest/v1/workspace_members",
      { workspace_id: workspaceId, user_id: userId, role, status: "active" },
      { prefer: "return=representation" },
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error("Failed to add workspace member.");
    }
    return mapMember(row);
  }

  async updateWorkspace(workspaceId: string, input: UpdateWorkspaceInput): Promise<Workspace> {
    const encoded = encodeURIComponent(workspaceId);
    const body: Record<string, unknown> = {};
    if (input.name !== undefined) {
      body["name"] = input.name;
    }
    if (input.description !== undefined) {
      body["description"] = input.description;
    }
    if (input.settings !== undefined) {
      body["settings"] = input.settings;
    }
    const rows = await this.requestJson<WorkspaceRow[]>(
      "PATCH",
      `/rest/v1/workspaces?id=eq.${encoded}`,
      body,
      { prefer: "return=representation" },
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error("Failed to update workspace.");
    }
    return mapWorkspace(row);
  }

  async softDeleteWorkspace(workspaceId: string): Promise<Workspace> {
    const encoded = encodeURIComponent(workspaceId);
    const rows = await this.requestJson<WorkspaceRow[]>(
      "PATCH",
      `/rest/v1/workspaces?id=eq.${encoded}&${ACTIVE_WORKSPACE_FILTER}`,
      { deleted_at: new Date().toISOString() },
      { prefer: "return=representation" },
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error("Failed to delete workspace.");
    }
    return mapWorkspace(row);
  }

  async listOwnedWorkspaceIds(userId: string): Promise<string[]> {
    const encoded = encodeURIComponent(userId);
    const rows = await this.requestJson<Array<{ id: string }>>(
      "GET",
      `/rest/v1/workspaces?select=id&owner_user_id=eq.${encoded}`,
    );
    return rows.map((row) => row.id);
  }

  async hardDeleteWorkspace(workspaceId: string): Promise<void> {
    const encoded = encodeURIComponent(workspaceId);
    await this.requestJson("DELETE", `/rest/v1/workspaces?id=eq.${encoded}`);
  }

  async createInvitation(input: CreateInvitationInput): Promise<WorkspaceInvitation> {
    const rows = await this.requestJson<InvitationRow[]>(
      "POST",
      "/rest/v1/workspace_invitations",
      {
        workspace_id: input.workspaceId,
        email: input.email,
        role: input.role,
        token_hash: input.tokenHash,
        invited_by_user_id: input.invitedByUserId,
        expires_at: input.expiresAt,
        status: "pending",
      },
      { prefer: "return=representation" },
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error("Failed to create invitation.");
    }
    return mapInvitation(row);
  }

  async listInvitations(workspaceId: string): Promise<WorkspaceInvitation[]> {
    const encoded = encodeURIComponent(workspaceId);
    const rows = await this.requestJson<InvitationRow[]>(
      "GET",
      `/rest/v1/workspace_invitations?select=id,workspace_id,email,role,invited_by_user_id,status,expires_at,accepted_at,accepted_by_user_id,created_at,updated_at&workspace_id=eq.${encoded}&order=created_at.desc`,
    );
    return rows.map(mapInvitation);
  }

  async findInvitationByTokenHash(tokenHash: string): Promise<WorkspaceInvitation | undefined> {
    const encoded = encodeURIComponent(tokenHash);
    const rows = await this.requestJson<InvitationRow[]>(
      "GET",
      `/rest/v1/workspace_invitations?select=id,workspace_id,email,role,invited_by_user_id,status,expires_at,accepted_at,accepted_by_user_id,created_at,updated_at&token_hash=eq.${encoded}&limit=1`,
    );
    const row = rows[0];
    return row === undefined ? undefined : mapInvitation(row);
  }

  async findPendingInvitationByEmail(
    workspaceId: string,
    email: string,
  ): Promise<WorkspaceInvitation | undefined> {
    const encodedWorkspaceId = encodeURIComponent(workspaceId);
    const encodedEmail = encodeURIComponent(email.toLowerCase());
    const rows = await this.requestJson<InvitationRow[]>(
      "GET",
      `/rest/v1/workspace_invitations?select=id,workspace_id,email,role,invited_by_user_id,status,expires_at,accepted_at,accepted_by_user_id,created_at,updated_at&workspace_id=eq.${encodedWorkspaceId}&email=ilike.${encodedEmail}&status=eq.pending&limit=1`,
    );
    const row = rows[0];
    return row === undefined ? undefined : mapInvitation(row);
  }

  async updateInvitation(
    invitationId: string,
    patch: {
      readonly status?: string;
      readonly acceptedAt?: string;
      readonly acceptedByUserId?: string;
    },
  ): Promise<WorkspaceInvitation> {
    const encoded = encodeURIComponent(invitationId);
    const body: Record<string, unknown> = {};
    if (patch.status !== undefined) {
      body["status"] = patch.status;
    }
    if (patch.acceptedAt !== undefined) {
      body["accepted_at"] = patch.acceptedAt;
    }
    if (patch.acceptedByUserId !== undefined) {
      body["accepted_by_user_id"] = patch.acceptedByUserId;
    }
    const rows = await this.requestJson<InvitationRow[]>(
      "PATCH",
      `/rest/v1/workspace_invitations?id=eq.${encoded}`,
      body,
      { prefer: "return=representation" },
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error("Failed to update invitation.");
    }
    return mapInvitation(row);
  }

  private requireConfig(): { baseUrl: string; serviceRoleKey: string } {
    if (!this.config.enabled) {
      throw new ServiceUnavailableException("Workspaces unavailable: Supabase is not configured.");
    }
    return { baseUrl: this.config.url, serviceRoleKey: this.config.serviceRoleKey };
  }

  private async requestJson<T>(
    method: "GET" | "POST" | "PATCH" | "DELETE",
    path: string,
    body?: unknown,
    options?: { prefer?: string },
  ): Promise<T> {
    const { baseUrl, serviceRoleKey } = this.requireConfig();

    const response = await fetch(`${baseUrl}${path}`, {
      method,
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        ...(options?.prefer ? { Prefer: options.prefer } : {}),
      },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Workspace query failed (${String(response.status)}): ${detail}`);
    }

    if (method === "DELETE") {
      return [] as T;
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return [] as T;
    }
    return (await response.json()) as T;
  }
}

function mapWorkspace(row: WorkspaceRow): Workspace {
  return {
    id: row.id,
    name: row.name,
    kind: row.is_personal ? "personal" : "shared",
    ownerUserId: row.owner_user_id,
    description: row.description,
    settings: row.settings ?? {},
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapMember(row: MemberRow): WorkspaceMember {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    userId: row.user_id,
    accountId: row.user_id,
    role: normalizeRole(row.role),
    status: normalizeStatus(row.status),
    joinedAt: row.joined_at ?? row.created_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapInvitation(row: InvitationRow): WorkspaceInvitation {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    email: row.email,
    role: row.role,
    invitedByUserId: row.invited_by_user_id,
    status: row.status,
    expiresAt: row.expires_at,
    acceptedAt: row.accepted_at,
    acceptedByUserId: row.accepted_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function normalizeRole(role: string): WorkspaceRole {
  if (role === "member") {
    return "developer";
  }
  if (role === "owner" || role === "admin" || role === "developer" || role === "viewer") {
    return role;
  }
  return "viewer";
}

function normalizeStatus(status: string | null): MembershipStatus {
  if (
    status === "active" ||
    status === "invited" ||
    status === "suspended" ||
    status === "left"
  ) {
    return status;
  }
  return "active";
}
