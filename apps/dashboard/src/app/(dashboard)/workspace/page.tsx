"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError, formatApiErrorMessage } from "@/lib/api/errors";
import { withAccessToken } from "@/lib/auth/with-access-token";
import {
  acceptInvitation,
  createApiKey,
  deleteWorkspace,
  inviteMember,
  listApiKeys,
  listInvitations,
  listMembers,
  removeMember,
  revokeApiKey,
  revokeInvitation,
  rotateApiKey,
  updateMemberRole,
  updateWorkspace,
} from "@/lib/workspaces/api";
import type { InviteRole, WorkspaceRole } from "@/lib/workspaces/types";

function workspaceErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ApiError) {
    return formatApiErrorMessage(err, fallback);
  }
  if (err instanceof Error) {
    return err.message;
  }
  return fallback;
}

/**
 * Workspace collaboration + API key settings for the active workspace.
 */
export default function WorkspaceSettingsPage() {
  return <WorkspaceSettingsContent />;
}

function WorkspaceSettingsContent() {
  const { getAccessToken } = useAuth();
  const { activeWorkspace, activeRole, isLoading, setActiveWorkspaceId, memberships } =
    useWorkspace();
  const queryClient = useQueryClient();
  const canManage = activeRole === "owner" || activeRole === "admin";
  const canDelete = activeRole === "owner" && activeWorkspace?.kind === "shared";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [formWorkspaceId, setFormWorkspaceId] = useState<string | null>(null);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteRole>("developer");
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [acceptToken, setAcceptToken] = useState("");
  const [apiKeyName, setApiKeyName] = useState("");
  const [createdApiToken, setCreatedApiToken] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [copiedInvite, setCopiedInvite] = useState(false);

  if (activeWorkspace !== null && formWorkspaceId !== activeWorkspace.id) {
    setFormWorkspaceId(activeWorkspace.id);
    setName(activeWorkspace.name);
    setDescription(activeWorkspace.description ?? "");
  }

  const workspaceId = activeWorkspace?.id;

  const membersQuery = useQuery({
    queryKey: ["workspace", workspaceId, "members"],
    enabled: workspaceId !== undefined,
    queryFn: async () => {
      const token = await getAccessToken();
      if (token === null || workspaceId === undefined) {
        throw new Error("Not authenticated");
      }
      return listMembers(token, workspaceId);
    },
  });

  const invitationsQuery = useQuery({
    queryKey: ["workspace", workspaceId, "invitations"],
    enabled: workspaceId !== undefined && canManage,
    queryFn: async () => {
      const token = await getAccessToken();
      if (token === null || workspaceId === undefined) {
        throw new Error("Not authenticated");
      }
      return listInvitations(token, workspaceId);
    },
  });

  const apiKeysQuery = useQuery({
    queryKey: ["workspace", workspaceId, "api-keys"],
    enabled: workspaceId !== undefined && canManage,
    queryFn: async () => {
      const token = await getAccessToken();
      if (token === null || workspaceId === undefined) {
        throw new Error("Not authenticated");
      }
      return listApiKeys(token, workspaceId);
    },
  });

  const saveSettings = useMutation({
    mutationFn: async () => {
      if (workspaceId === undefined) {
        throw new Error("Not authenticated");
      }
      const id = workspaceId;
      return withAccessToken(getAccessToken, (token) =>
        updateWorkspace(token, id, {
          name: name.trim().length > 0 ? name.trim() : undefined,
          description: description.trim().length > 0 ? description.trim() : null,
        }),
      );
    },
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
    onError: (err: unknown) => {
      setError(workspaceErrorMessage(err, "Failed to save settings"));
    },
  });

  const invite = useMutation({
    mutationFn: async () => {
      if (workspaceId === undefined) {
        throw new Error("Not authenticated");
      }
      const id = workspaceId;
      return withAccessToken(getAccessToken, (token) =>
        inviteMember(token, id, inviteEmail, inviteRole),
      );
    },
    onSuccess: async (result) => {
      setInviteToken(result.token);
      setInviteEmail("");
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId, "invitations"] });
    },
    onError: (err: unknown) => {
      setError(workspaceErrorMessage(err, "Failed to invite"));
    },
  });

  const accept = useMutation({
    mutationFn: async () => {
      const inviteTokenValue = acceptToken.trim();
      if (inviteTokenValue.length === 0) {
        throw new Error("Invitation token is required.");
      }
      return withAccessToken(getAccessToken, (token) =>
        acceptInvitation(token, inviteTokenValue),
      );
    },
    onSuccess: async () => {
      setAcceptToken("");
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
    onError: (err: unknown) => {
      setError(workspaceErrorMessage(err, "Failed to accept invitation"));
    },
  });

  const createKey = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      if (token === null || workspaceId === undefined) {
        throw new Error("Not authenticated");
      }
      return createApiKey(token, workspaceId, apiKeyName);
    },
    onSuccess: async (result) => {
      setCreatedApiToken(result.token);
      setApiKeyName("");
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId, "api-keys"] });
    },
    onError: (err: unknown) => {
      setError(workspaceErrorMessage(err, "Failed to create API key"));
    },
  });

  if (isLoading || activeWorkspace === null) {
    return (
      <div className="space-y-3 py-8" aria-busy="true">
        <p className="font-mono text-[12px] text-pale-stone uppercase">Workspace</p>
        <p className="text-sm text-warm-granite">Loading workspace…</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <p className="font-mono text-[12px] tracking-[-0.02em] text-pale-stone uppercase">
          Workspace
        </p>
        <h2 className="mt-1 text-[36px] leading-[1.1] tracking-[-1.12px] text-bone">
          {activeWorkspace.name}
        </h2>
        <p className="mt-2 text-sm text-warm-granite">
          Role: <Badge variant="outline" className="rounded-[3px]">{activeRole ?? "—"}</Badge>
        </p>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <Tabs defaultValue="general">
        <TabsList>
          <TabsTrigger value="general">General</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="invites">Invites</TabsTrigger>
          {canManage ? <TabsTrigger value="api-keys">API keys</TabsTrigger> : null}
        </TabsList>

        <TabsContent value="general" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Workspace settings</CardTitle>
              <CardDescription>Update the display name and description.</CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="space-y-3"
                onSubmit={(event: FormEvent) => {
                  event.preventDefault();
                  if (!canManage) {
                    return;
                  }
                  void saveSettings.mutateAsync();
                }}
              >
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground" htmlFor="ws-name">
                    Name
                  </label>
                  <Input
                    id="ws-name"
                    value={name}
                    disabled={!canManage}
                    onChange={(e) => setName(e.target.value)}
                    className="rounded-[3px]"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground" htmlFor="ws-desc">
                    Description
                  </label>
                  <Input
                    id="ws-desc"
                    value={description}
                    disabled={!canManage}
                    onChange={(e) => setDescription(e.target.value)}
                    className="rounded-[3px]"
                  />
                </div>
                {canManage ? (
                  <Button type="submit" disabled={saveSettings.isPending}>
                    Save
                  </Button>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Only owners and admins can edit settings.
                  </p>
                )}
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Accept invitation</CardTitle>
              <CardDescription>
                Sign in as the invited email, then paste the invite token to join that workspace.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="flex flex-col gap-2 sm:flex-row"
                onSubmit={(event: FormEvent) => {
                  event.preventDefault();
                  accept.mutate();
                }}
              >
                <Input
                  value={acceptToken}
                  onChange={(e) => setAcceptToken(e.target.value)}
                  placeholder="Invitation token"
                />
                <Button type="submit" disabled={accept.isPending || acceptToken.trim().length === 0}>
                  Accept
                </Button>
              </form>
            </CardContent>
          </Card>

          {canDelete ? (
            <Card>
              <CardHeader>
                <CardTitle>Delete workspace</CardTitle>
                <CardDescription>
                  Soft-deletes this shared workspace. Personal workspaces cannot be deleted. Type
                  the exact workspace name to confirm.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-3"
                  onSubmit={(event: FormEvent) => {
                    event.preventDefault();
                    void (async () => {
                      setError(null);
                      const token = await getAccessToken();
                      if (token === null || workspaceId === undefined || activeWorkspace === null) {
                        return;
                      }
                      try {
                        await deleteWorkspace(token, workspaceId, deleteConfirmation);
                        const fallback =
                          memberships.find((m) => m.workspace.kind === "personal") ??
                          memberships.find((m) => m.workspace.id !== workspaceId);
                        if (fallback !== undefined) {
                          setActiveWorkspaceId(fallback.workspace.id);
                        }
                        setDeleteConfirmation("");
                        await queryClient.invalidateQueries({ queryKey: ["workspace"] });
                      } catch (cause: unknown) {
                        setError(
                          cause instanceof Error ? cause.message : "Unable to delete workspace.",
                        );
                      }
                    })();
                  }}
                >
                  <Input
                    value={deleteConfirmation}
                    onChange={(e) => setDeleteConfirmation(e.target.value)}
                    placeholder={activeWorkspace.name}
                    autoComplete="off"
                  />
                  <Button
                    type="submit"
                    variant="destructive"
                    disabled={deleteConfirmation.trim() !== activeWorkspace.name}
                  >
                    Delete workspace
                  </Button>
                </form>
              </CardContent>
            </Card>
          ) : null}
        </TabsContent>

        <TabsContent value="members">
          <Card>
            <CardHeader>
              <CardTitle>Members</CardTitle>
              <CardDescription>People with access to this workspace.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {membersQuery.isPending ? (
                <p className="text-sm text-warm-granite">Loading members…</p>
              ) : membersQuery.isError ? (
                <p className="text-sm text-signal-orange">Could not load members.</p>
              ) : (membersQuery.data ?? []).length === 0 ? (
                <p className="text-sm text-warm-granite">No members found.</p>
              ) : (
                (membersQuery.data ?? []).map((member) => (
                <div
                  key={member.id}
                  className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 py-2 last:border-0"
                >
                  <div>
                    <p className="font-mono text-xs">{member.userId}</p>
                    <Badge variant="outline">{member.role}</Badge>
                  </div>
                  {canManage && member.role !== "owner" ? (
                    <div className="flex items-center gap-2">
                      <Select
                        value={member.role}
                        onValueChange={(value) => {
                          void (async () => {
                            const token = await getAccessToken();
                            if (token === null || workspaceId === undefined) {
                              return;
                            }
                            try {
                              await updateMemberRole(
                                token,
                                workspaceId,
                                member.userId,
                                value as Exclude<WorkspaceRole, "owner">,
                              );
                              await queryClient.invalidateQueries({
                                queryKey: ["workspace", workspaceId, "members"],
                              });
                            } catch (cause: unknown) {
                              setError(
                                cause instanceof Error ? cause.message : "Failed to update role",
                              );
                            }
                          })();
                        }}
                      >
                        <SelectTrigger size="sm" className="w-[130px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="admin">admin</SelectItem>
                          <SelectItem value="developer">developer</SelectItem>
                          <SelectItem value="viewer">viewer</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          void (async () => {
                            const token = await getAccessToken();
                            if (token === null || workspaceId === undefined) {
                              return;
                            }
                            try {
                              await removeMember(token, workspaceId, member.userId);
                              await queryClient.invalidateQueries({
                                queryKey: ["workspace", workspaceId, "members"],
                              });
                            } catch (cause: unknown) {
                              setError(
                                cause instanceof Error ? cause.message : "Failed to remove member",
                              );
                            }
                          })();
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invites" className="space-y-4">
          {canManage ? (
            <Card>
              <CardHeader>
                <CardTitle>Invite member</CardTitle>
                <CardDescription>
                  Creates a pending invite. Share the one-time token with the invitee.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <form
                  className="flex flex-col gap-2 sm:flex-row"
                  onSubmit={(event: FormEvent) => {
                    event.preventDefault();
                    void invite.mutate();
                  }}
                >
                  <Input
                    type="email"
                    value={inviteEmail}
                    onChange={(e) => setInviteEmail(e.target.value)}
                    placeholder="email@example.com"
                  />
                  <Select
                    value={inviteRole}
                    onValueChange={(value) => setInviteRole(value as InviteRole)}
                  >
                    <SelectTrigger size="sm" className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="admin">admin</SelectItem>
                      <SelectItem value="developer">developer</SelectItem>
                      <SelectItem value="viewer">viewer</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="submit" disabled={invite.isPending || inviteEmail.trim().length === 0}>
                    Invite
                  </Button>
                </form>
                {inviteToken ? (
                  <div className="space-y-2 rounded-[3px] border border-ash-stroke bg-obsidian-canvas p-3">
                    <p className="font-mono text-[12px] text-pale-stone uppercase">
                      Invite token — copy now
                    </p>
                    <p className="break-all font-mono text-xs text-bone">{inviteToken}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-[3px]"
                      onClick={() => {
                        void navigator.clipboard.writeText(inviteToken).then(() => {
                          setCopiedInvite(true);
                          window.setTimeout(() => setCopiedInvite(false), 1500);
                        });
                      }}
                    >
                      {copiedInvite ? "Copied" : "Copy token"}
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>
          ) : null}

          <Card>
            <CardHeader>
              <CardTitle>Pending invitations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {!canManage ? (
                <p className="text-sm text-muted-foreground">
                  Only owners and admins can manage invitations.
                </p>
              ) : invitationsQuery.isPending ? (
                <p className="text-sm text-warm-granite">Loading invitations…</p>
              ) : invitationsQuery.isError ? (
                <p className="text-sm text-signal-orange">Could not load invitations.</p>
              ) : (invitationsQuery.data ?? []).filter((row) => row.status === "pending").length ===
                0 ? (
                <p className="text-sm text-warm-granite">No pending invitations.</p>
              ) : (
                (invitationsQuery.data ?? [])
                  .filter((row) => row.status === "pending")
                  .map((invitation) => (
                    <div
                      key={invitation.id}
                      className="flex items-center justify-between gap-2 border-b border-border/60 py-2 last:border-0"
                    >
                      <div>
                        <p className="text-sm">{invitation.email}</p>
                        <p className="text-xs text-muted-foreground">
                          {invitation.role} · expires {new Date(invitation.expiresAt).toLocaleString()}
                        </p>
                      </div>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          void (async () => {
                            const token = await getAccessToken();
                            if (token === null || workspaceId === undefined) {
                              return;
                            }
                            try {
                              await revokeInvitation(token, workspaceId, invitation.id);
                              await queryClient.invalidateQueries({
                                queryKey: ["workspace", workspaceId, "invitations"],
                              });
                            } catch (cause: unknown) {
                              setError(
                                cause instanceof Error
                                  ? cause.message
                                  : "Failed to revoke invitation",
                              );
                            }
                          })();
                        }}
                      >
                        Revoke
                      </Button>
                    </div>
                  ))
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {canManage ? (
          <TabsContent value="api-keys" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Create API key</CardTitle>
                <CardDescription>
                  Workspace-scoped keys for CI. Plaintext is shown once and never stored.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <form
                  className="flex flex-col gap-2 sm:flex-row"
                  onSubmit={(event: FormEvent) => {
                    event.preventDefault();
                    void createKey.mutateAsync();
                  }}
                >
                  <Input
                    value={apiKeyName}
                    onChange={(e) => setApiKeyName(e.target.value)}
                    placeholder="Key name (e.g. GitHub Actions)"
                  />
                  <Button
                    type="submit"
                    disabled={createKey.isPending || apiKeyName.trim().length < 2}
                  >
                    Create
                  </Button>
                </form>
                {createdApiToken ? (
                  <div className="space-y-2 rounded-[3px] border border-ash-stroke bg-obsidian-canvas p-3">
                    <p className="font-mono text-[12px] text-pale-stone uppercase">
                      Secret — copy now
                    </p>
                    <p className="break-all font-mono text-xs text-bone">{createdApiToken}</p>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="rounded-[3px]"
                      onClick={() => {
                        void navigator.clipboard.writeText(createdApiToken);
                      }}
                    >
                      Copy secret
                    </Button>
                  </div>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>API keys</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {apiKeysQuery.isPending ? (
                  <p className="text-sm text-warm-granite">Loading API keys…</p>
                ) : apiKeysQuery.isError ? (
                  <p className="text-sm text-signal-orange">Could not load API keys.</p>
                ) : (apiKeysQuery.data ?? []).length === 0 ? (
                  <p className="text-sm text-warm-granite">No API keys yet.</p>
                ) : (
                  (apiKeysQuery.data ?? []).map((key) => (
                  <div
                    key={key.id}
                    className="flex flex-wrap items-center justify-between gap-2 border-b border-border/60 py-2 last:border-0"
                  >
                    <div>
                      <p className="text-sm font-medium">{key.name}</p>
                      <p className="font-mono text-xs text-muted-foreground">
                        {key.keyPrefix}… · last used{" "}
                        {key.lastUsedAt ? new Date(key.lastUsedAt).toLocaleString() : "never"}
                      </p>
                      {key.revokedAt ? (
                        <Badge variant="outline">revoked</Badge>
                      ) : null}
                    </div>
                    {key.revokedAt === null ? (
                      <div className="flex gap-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            void (async () => {
                              const token = await getAccessToken();
                              if (token === null || workspaceId === undefined) {
                                return;
                              }
                              try {
                                const rotated = await rotateApiKey(token, workspaceId, key.id);
                                setCreatedApiToken(rotated.token);
                                await queryClient.invalidateQueries({
                                  queryKey: ["workspace", workspaceId, "api-keys"],
                                });
                              } catch (cause: unknown) {
                                setError(
                                  cause instanceof Error ? cause.message : "Failed to rotate key",
                                );
                              }
                            })();
                          }}
                        >
                          Rotate
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            void (async () => {
                              const token = await getAccessToken();
                              if (token === null || workspaceId === undefined) {
                                return;
                              }
                              try {
                                await revokeApiKey(token, workspaceId, key.id);
                                await queryClient.invalidateQueries({
                                  queryKey: ["workspace", workspaceId, "api-keys"],
                                });
                              } catch (cause: unknown) {
                                setError(
                                  cause instanceof Error ? cause.message : "Failed to revoke key",
                                );
                              }
                            })();
                          }}
                        >
                          Revoke
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))
                )}
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
