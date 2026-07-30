import { apiClient } from "@/lib/api/client";

import type {
  CreatedApiKey,
  CreatedInvitation,
  InviteRole,
  Workspace,
  WorkspaceApiKey,
  WorkspaceContextResponse,
  WorkspaceInvitation,
  WorkspaceMember,
  WorkspaceMembership,
  WorkspaceRole,
} from "./types";

function authHeaders(accessToken: string): HeadersInit {
  return { Authorization: `Bearer ${accessToken}` };
}

export async function listWorkspaces(accessToken: string): Promise<WorkspaceMembership[]> {
  return apiClient<WorkspaceMembership[]>("/api/v1/workspaces", {
    headers: authHeaders(accessToken),
  });
}

export async function resolveWorkspaceContext(
  accessToken: string,
  workspaceId?: string,
): Promise<WorkspaceContextResponse> {
  const query = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";
  return apiClient<WorkspaceContextResponse>(`/api/v1/workspaces/context${query}`, {
    headers: authHeaders(accessToken),
  });
}

export async function createWorkspace(accessToken: string, name: string): Promise<Workspace> {
  return apiClient<Workspace>("/api/v1/workspaces", {
    method: "POST",
    headers: authHeaders(accessToken),
    json: { name },
  });
}

export async function getWorkspace(accessToken: string, workspaceId: string): Promise<Workspace> {
  return apiClient<Workspace>(`/api/v1/workspaces/${workspaceId}`, {
    headers: authHeaders(accessToken),
  });
}

export async function updateWorkspace(
  accessToken: string,
  workspaceId: string,
  body: {
    readonly name?: string;
    readonly description?: string | null;
    readonly settings?: Record<string, unknown>;
  },
): Promise<Workspace> {
  return apiClient<Workspace>(`/api/v1/workspaces/${workspaceId}`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    json: body,
  });
}

/**
 * Soft-deletes a shared workspace (owner only; confirmationName must match).
 */
export async function deleteWorkspace(
  accessToken: string,
  workspaceId: string,
  confirmationName: string,
): Promise<void> {
  await apiClient<void>(`/api/v1/workspaces/${workspaceId}`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
    json: { confirmationName },
  });
}

export async function listMembers(
  accessToken: string,
  workspaceId: string,
): Promise<WorkspaceMember[]> {
  return apiClient<WorkspaceMember[]>(`/api/v1/workspaces/${workspaceId}/members`, {
    headers: authHeaders(accessToken),
  });
}

export async function updateMemberRole(
  accessToken: string,
  workspaceId: string,
  userId: string,
  role: Exclude<WorkspaceRole, "owner">,
): Promise<WorkspaceMember> {
  return apiClient<WorkspaceMember>(`/api/v1/workspaces/${workspaceId}/members/${userId}`, {
    method: "PATCH",
    headers: authHeaders(accessToken),
    json: { role },
  });
}

export async function removeMember(
  accessToken: string,
  workspaceId: string,
  userId: string,
): Promise<void> {
  await apiClient<{ ok: true }>(`/api/v1/workspaces/${workspaceId}/members/${userId}`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
  });
}

export async function listInvitations(
  accessToken: string,
  workspaceId: string,
): Promise<WorkspaceInvitation[]> {
  return apiClient<WorkspaceInvitation[]>(`/api/v1/workspaces/${workspaceId}/invitations`, {
    headers: authHeaders(accessToken),
  });
}

export async function inviteMember(
  accessToken: string,
  workspaceId: string,
  email: string,
  role: InviteRole,
): Promise<CreatedInvitation> {
  return apiClient<CreatedInvitation>(`/api/v1/workspaces/${workspaceId}/invitations`, {
    method: "POST",
    headers: authHeaders(accessToken),
    json: { email, role },
  });
}

export async function revokeInvitation(
  accessToken: string,
  workspaceId: string,
  invitationId: string,
): Promise<WorkspaceInvitation> {
  return apiClient<WorkspaceInvitation>(
    `/api/v1/workspaces/${workspaceId}/invitations/${invitationId}`,
    {
      method: "DELETE",
      headers: authHeaders(accessToken),
    },
  );
}

export async function acceptInvitation(
  accessToken: string,
  token: string,
): Promise<WorkspaceMembership> {
  return apiClient<WorkspaceMembership>("/api/v1/workspaces/invitations/accept", {
    method: "POST",
    headers: authHeaders(accessToken),
    json: { token },
  });
}

export async function listApiKeys(
  accessToken: string,
  workspaceId: string,
): Promise<WorkspaceApiKey[]> {
  return apiClient<WorkspaceApiKey[]>(`/api/v1/workspaces/${workspaceId}/api-keys`, {
    headers: authHeaders(accessToken),
  });
}

export async function createApiKey(
  accessToken: string,
  workspaceId: string,
  name: string,
): Promise<CreatedApiKey> {
  return apiClient<CreatedApiKey>(`/api/v1/workspaces/${workspaceId}/api-keys`, {
    method: "POST",
    headers: authHeaders(accessToken),
    json: { name },
  });
}

export async function rotateApiKey(
  accessToken: string,
  workspaceId: string,
  keyId: string,
): Promise<CreatedApiKey> {
  return apiClient<CreatedApiKey>(`/api/v1/workspaces/${workspaceId}/api-keys/${keyId}/rotate`, {
    method: "POST",
    headers: authHeaders(accessToken),
  });
}

export async function revokeApiKey(
  accessToken: string,
  workspaceId: string,
  keyId: string,
): Promise<WorkspaceApiKey> {
  return apiClient<WorkspaceApiKey>(`/api/v1/workspaces/${workspaceId}/api-keys/${keyId}`, {
    method: "DELETE",
    headers: authHeaders(accessToken),
  });
}
