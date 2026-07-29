"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { RequireAuth } from "@/components/auth/require-auth";
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
import {
  acceptInvitation,
  createApiKey,
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

/**
 * Workspace collaboration + API key settings for the active workspace.
 */
export default function WorkspaceSettingsPage() {
  return (
    <RequireAuth>
      <WorkspaceSettingsContent />
    </RequireAuth>
  );
}

function WorkspaceSettingsContent() {
  const { getAccessToken } = useAuth();
  const { activeWorkspace, activeRole, isLoading } = useWorkspace();
  const queryClient = useQueryClient();
  const canManage = activeRole === "owner" || activeRole === "admin";

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<InviteRole>("developer");
  const [inviteToken, setInviteToken] = useState<string | null>(null);
  const [acceptToken, setAcceptToken] = useState("");
  const [apiKeyName, setApiKeyName] = useState("");
  const [createdApiToken, setCreatedApiToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

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
      const token = await getAccessToken();
      if (token === null || workspaceId === undefined) {
        throw new Error("Not authenticated");
      }
      return updateWorkspace(token, workspaceId, {
        name: name.trim().length > 0 ? name.trim() : undefined,
        description: description.trim().length > 0 ? description.trim() : null,
      });
    },
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : "Failed to save settings");
    },
  });

  const invite = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      if (token === null || workspaceId === undefined) {
        throw new Error("Not authenticated");
      }
      return inviteMember(token, workspaceId, inviteEmail, inviteRole);
    },
    onSuccess: async (result) => {
      setInviteToken(result.token);
      setInviteEmail("");
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["workspace", workspaceId, "invitations"] });
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : "Failed to invite");
    },
  });

  const accept = useMutation({
    mutationFn: async () => {
      const token = await getAccessToken();
      if (token === null) {
        throw new Error("Not authenticated");
      }
      return acceptInvitation(token, acceptToken);
    },
    onSuccess: async () => {
      setAcceptToken("");
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["workspace"] });
    },
    onError: (err: unknown) => {
      setError(err instanceof Error ? err.message : "Failed to accept invitation");
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
      setError(err instanceof Error ? err.message : "Failed to create API key");
    },
  });

  if (isLoading || activeWorkspace === null) {
    return <p className="text-sm text-muted-foreground">Loading workspace…</p>;
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div>
        <h2 className="font-heading text-xl tracking-tight">{activeWorkspace.name}</h2>
        <p className="text-sm text-muted-foreground">
          Role: <Badge variant="outline">{activeRole ?? "—"}</Badge>
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
                    defaultValue={activeWorkspace.name}
                    disabled={!canManage}
                    onChange={(e) => setName(e.target.value)}
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-sm text-muted-foreground" htmlFor="ws-desc">
                    Description
                  </label>
                  <Input
                    id="ws-desc"
                    defaultValue={activeWorkspace.description ?? ""}
                    disabled={!canManage}
                    onChange={(e) => setDescription(e.target.value)}
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
                Paste an invite token shared with your email to join a workspace.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form
                className="flex flex-col gap-2 sm:flex-row"
                onSubmit={(event: FormEvent) => {
                  event.preventDefault();
                  void accept.mutateAsync();
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
        </TabsContent>

        <TabsContent value="members">
          <Card>
            <CardHeader>
              <CardTitle>Members</CardTitle>
              <CardDescription>People with access to this workspace.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(membersQuery.data ?? []).map((member) => (
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
                            await updateMemberRole(
                              token,
                              workspaceId,
                              member.userId,
                              value as Exclude<WorkspaceRole, "owner">,
                            );
                            await queryClient.invalidateQueries({
                              queryKey: ["workspace", workspaceId, "members"],
                            });
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
                            await removeMember(token, workspaceId, member.userId);
                            await queryClient.invalidateQueries({
                              queryKey: ["workspace", workspaceId, "members"],
                            });
                          })();
                        }}
                      >
                        Remove
                      </Button>
                    </div>
                  ) : null}
                </div>
              ))}
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
                    void invite.mutateAsync();
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
                  <p className="break-all rounded-md bg-muted p-2 font-mono text-xs">
                    Token (copy now): {inviteToken}
                  </p>
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
                            await revokeInvitation(token, workspaceId, invitation.id);
                            await queryClient.invalidateQueries({
                              queryKey: ["workspace", workspaceId, "invitations"],
                            });
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
                  <p className="break-all rounded-md bg-muted p-2 font-mono text-xs">
                    Secret (copy now): {createdApiToken}
                  </p>
                ) : null}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>API keys</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {(apiKeysQuery.data ?? []).map((key) => (
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
                              const rotated = await rotateApiKey(token, workspaceId, key.id);
                              setCreatedApiToken(rotated.token);
                              await queryClient.invalidateQueries({
                                queryKey: ["workspace", workspaceId, "api-keys"],
                              });
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
                              await revokeApiKey(token, workspaceId, key.id);
                              await queryClient.invalidateQueries({
                                queryKey: ["workspace", workspaceId, "api-keys"],
                              });
                            })();
                          }}
                        >
                          Revoke
                        </Button>
                      </div>
                    ) : null}
                  </div>
                ))}
              </CardContent>
            </Card>
          </TabsContent>
        ) : null}
      </Tabs>
    </div>
  );
}
