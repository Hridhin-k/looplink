"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";

import { EmptyState } from "@/components/layout/empty-state";
import { PageHeader } from "@/components/layout/page-header";
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
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ConfirmAction, SecretReveal } from "@/components/workspaces/workspace-actions";
import { WorkspaceOverview } from "@/components/workspaces/workspace-overview";
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
 * Workspace Hub — overview of health/activity, then collaboration settings.
 */
export default function WorkspaceHubPage() {
  return <WorkspaceHubContent />;
}

function WorkspaceHubContent() {
  const { getAccessToken } = useAuth();
  const { activeWorkspace, activeRole, isLoading, setActiveWorkspaceId, memberships } =
    useWorkspace();
  const queryClient = useQueryClient();
  const canManage = activeRole === "owner" || activeRole === "admin";
  const canDelete = activeRole === "owner" && activeWorkspace?.kind === "shared";

  const [settingsTab, setSettingsTab] = useState("general");
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
  const [savedFlash, setSavedFlash] = useState(false);

  if (activeWorkspace !== null && formWorkspaceId !== activeWorkspace.id) {
    setFormWorkspaceId(activeWorkspace.id);
    setName(activeWorkspace.name);
    setDescription(activeWorkspace.description ?? "");
    setInviteToken(null);
    setCreatedApiToken(null);
    setError(null);
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
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 1_600);
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

  const openSettings = (tab: string): void => {
    setSettingsTab(tab);
    window.requestAnimationFrame(() => {
      document.getElementById("workspace-settings")?.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    });
  };

  if (isLoading || activeWorkspace === null) {
    return (
      <div className="mx-auto max-w-5xl space-y-6 py-2" aria-busy="true">
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-9 w-64 max-w-full" />
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }, (_, index) => (
            <Skeleton key={index} className="h-32 rounded-[10px]" />
          ))}
        </div>
      </div>
    );
  }

  const pendingInvites = (invitationsQuery.data ?? []).filter(
    (row) => row.status === "pending",
  ).length;

  return (
    <div className="mx-auto max-w-5xl space-y-10">
      <PageHeader
        eyebrow="Workspace"
        title={activeWorkspace.name}
        description={
          <span className="inline-flex flex-wrap items-center gap-2">
            <Badge variant="outline">{activeWorkspace.kind}</Badge>
            <Badge variant="outline">{activeRole ?? "—"}</Badge>
            {activeWorkspace.description ? (
              <span className="text-warm-granite">{activeWorkspace.description}</span>
            ) : null}
          </span>
        }
      />

      {error ? (
        <p className="rounded-[3px] border border-signal-orange/40 bg-signal-orange/10 px-3 py-2 text-sm text-signal-orange" role="alert">
          {error}
        </p>
      ) : null}

      <WorkspaceOverview
        members={membersQuery.data}
        membersLoading={membersQuery.isPending}
        apiKeys={apiKeysQuery.data}
        apiKeysLoading={apiKeysQuery.isPending}
        canManageKeys={canManage}
        pendingInvites={pendingInvites}
        invitations={invitationsQuery.data}
        onOpenSettings={openSettings}
      />

      <section id="workspace-settings" className="scroll-mt-28 space-y-4">
        <div>
          <p className="text-caption text-pale-stone">Settings</p>
          <h2 className="mt-1.5 text-xl tracking-tight text-bone">Manage this workspace</h2>
          <p className="mt-1 text-sm text-warm-granite">
            Collaboration, invitations, and automation keys.
          </p>
        </div>

        <Tabs value={settingsTab} onValueChange={setSettingsTab} className="gap-4">
          <TabsList variant="line" className="w-full justify-start gap-0 overflow-x-auto border-b border-ash-stroke">
            <TabsTrigger value="general" className="rounded-none">
              General
            </TabsTrigger>
            <TabsTrigger value="members" className="rounded-none">
              Members
            </TabsTrigger>
            <TabsTrigger value="invites" className="rounded-none">
              Invites
            </TabsTrigger>
            {canManage ? (
              <TabsTrigger value="api-keys" className="rounded-none">
                API keys
              </TabsTrigger>
            ) : null}
          </TabsList>

          <TabsContent value="general" className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Workspace profile</CardTitle>
                <CardDescription>Update the display name and description.</CardDescription>
              </CardHeader>
              <CardContent>
                <form
                  className="space-y-4"
                  onSubmit={(event: FormEvent) => {
                    event.preventDefault();
                    if (!canManage) {
                      return;
                    }
                    void saveSettings.mutateAsync();
                  }}
                >
                  <div className="space-y-1.5">
                    <label className="text-caption text-pale-stone" htmlFor="ws-name">
                      Name
                    </label>
                    <Input
                      id="ws-name"
                      value={name}
                      disabled={!canManage}
                      onChange={(e) => setName(e.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-caption text-pale-stone" htmlFor="ws-desc">
                      Description
                    </label>
                    <Input
                      id="ws-desc"
                      value={description}
                      disabled={!canManage}
                      onChange={(e) => setDescription(e.target.value)}
                      placeholder="Optional"
                    />
                  </div>
                  {canManage ? (
                    <div className="flex flex-wrap items-center gap-3">
                      <Button type="submit" disabled={saveSettings.isPending}>
                        {saveSettings.isPending ? "Saving…" : "Save changes"}
                      </Button>
                      {savedFlash ? (
                        <span className="text-xs text-metric-green">Saved</span>
                      ) : null}
                    </div>
                  ) : (
                    <p className="text-sm text-warm-granite">
                      Only owners and admins can edit settings.
                    </p>
                  )}
                </form>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Join another workspace</CardTitle>
                <CardDescription>
                  Sign in as the invited email, then paste the invite token.
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
                    className="font-mono text-xs"
                  />
                  <Button
                    type="submit"
                    disabled={accept.isPending || acceptToken.trim().length === 0}
                  >
                    {accept.isPending ? "Accepting…" : "Accept invite"}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {canDelete ? (
              <Card className="border-signal-orange/30">
                <CardHeader>
                  <CardTitle>Delete workspace</CardTitle>
                  <CardDescription>
                    Soft-deletes this shared workspace. Type the exact workspace name to confirm.
                    Personal workspaces cannot be deleted.
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
              <CardContent className="space-y-1">
                {membersQuery.isPending ? (
                  <p className="py-6 text-sm text-warm-granite">Loading members…</p>
                ) : membersQuery.isError ? (
                  <p className="py-6 text-sm text-signal-orange">Could not load members.</p>
                ) : (membersQuery.data ?? []).length === 0 ? (
                  <EmptyState
                    compact
                    eyebrow="No members"
                    title="No members found"
                    description="Membership should always include at least the owner."
                    className="border-0 shadow-none"
                  />
                ) : (
                  (membersQuery.data ?? []).map((member) => (
                    <div
                      key={member.id}
                      className="flex flex-wrap items-center justify-between gap-3 border-b border-ash-stroke py-3 last:border-0"
                    >
                      <div className="min-w-0 space-y-1.5">
                        <p className="truncate font-mono text-xs text-bone">{member.userId}</p>
                        <Badge variant="outline">{member.role}</Badge>
                      </div>
                      {canManage && member.role !== "owner" ? (
                        <div className="flex flex-wrap items-center gap-2">
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
                                  setError(null);
                                  await queryClient.invalidateQueries({
                                    queryKey: ["workspace", workspaceId, "members"],
                                  });
                                } catch (cause: unknown) {
                                  setError(
                                    cause instanceof Error
                                      ? cause.message
                                      : "Failed to update role",
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
                          <ConfirmAction
                            label="Remove"
                            confirmLabel="Confirm remove"
                            onConfirm={() => {
                              void (async () => {
                                const token = await getAccessToken();
                                if (token === null || workspaceId === undefined) {
                                  return;
                                }
                                try {
                                  await removeMember(token, workspaceId, member.userId);
                                  setError(null);
                                  await queryClient.invalidateQueries({
                                    queryKey: ["workspace", workspaceId, "members"],
                                  });
                                } catch (cause: unknown) {
                                  setError(
                                    cause instanceof Error
                                      ? cause.message
                                      : "Failed to remove member",
                                  );
                                }
                              })();
                            }}
                          />
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
                  <CardTitle>Invite a teammate</CardTitle>
                  <CardDescription>
                    Creates a pending invite. Share the one-time token with the invitee.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form
                    className="flex flex-col gap-2 lg:flex-row"
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
                      className="lg:flex-1"
                    />
                    <Select
                      value={inviteRole}
                      onValueChange={(value) => setInviteRole(value as InviteRole)}
                    >
                      <SelectTrigger size="sm" className="w-full lg:w-[140px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">admin</SelectItem>
                        <SelectItem value="developer">developer</SelectItem>
                        <SelectItem value="viewer">viewer</SelectItem>
                      </SelectContent>
                    </Select>
                    <Button
                      type="submit"
                      disabled={invite.isPending || inviteEmail.trim().length === 0}
                    >
                      {invite.isPending ? "Inviting…" : "Send invite"}
                    </Button>
                  </form>
                  {inviteToken ? (
                    <SecretReveal
                      label="Invite token — copy now"
                      value={inviteToken}
                      hint="This token is shown once. The invitee pastes it under Join another workspace."
                    />
                  ) : null}
                </CardContent>
              </Card>
            ) : null}

            <Card>
              <CardHeader>
                <CardTitle>Pending invitations</CardTitle>
                <CardDescription>Outstanding invites for this workspace.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-1">
                {!canManage ? (
                  <p className="py-6 text-sm text-warm-granite">
                    Only owners and admins can manage invitations.
                  </p>
                ) : invitationsQuery.isPending ? (
                  <p className="py-6 text-sm text-warm-granite">Loading invitations…</p>
                ) : invitationsQuery.isError ? (
                  <p className="py-6 text-sm text-signal-orange">Could not load invitations.</p>
                ) : pendingInvites === 0 ? (
                  <EmptyState
                    compact
                    eyebrow="No invites"
                    title="No pending invitations"
                    description="Invite a teammate when you need shared inspector access."
                    className="border-0 shadow-none"
                  />
                ) : (
                  (invitationsQuery.data ?? [])
                    .filter((row) => row.status === "pending")
                    .map((invitation) => (
                      <div
                        key={invitation.id}
                        className="flex flex-wrap items-center justify-between gap-3 border-b border-ash-stroke py-3 last:border-0"
                      >
                        <div className="min-w-0">
                          <p className="truncate text-sm text-bone">{invitation.email}</p>
                          <p className="mt-1 text-xs text-warm-granite">
                            {invitation.role} · expires{" "}
                            {new Date(invitation.expiresAt).toLocaleString()}
                          </p>
                        </div>
                        <ConfirmAction
                          label="Revoke"
                          confirmLabel="Confirm revoke"
                          onConfirm={() => {
                            void (async () => {
                              const token = await getAccessToken();
                              if (token === null || workspaceId === undefined) {
                                return;
                              }
                              try {
                                await revokeInvitation(token, workspaceId, invitation.id);
                                setError(null);
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
                        />
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
                <CardContent className="space-y-4">
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
                      className="sm:flex-1"
                    />
                    <Button
                      type="submit"
                      disabled={createKey.isPending || apiKeyName.trim().length < 2}
                    >
                      {createKey.isPending ? "Creating…" : "Create key"}
                    </Button>
                  </form>
                  {createdApiToken ? (
                    <SecretReveal
                      label="API secret — copy now"
                      value={createdApiToken}
                      hint="Use with badger login --token. This secret will not be shown again."
                    />
                  ) : null}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>API keys</CardTitle>
                  <CardDescription>Rotate or revoke keys used by automation.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-1">
                  {apiKeysQuery.isPending ? (
                    <p className="py-6 text-sm text-warm-granite">Loading API keys…</p>
                  ) : apiKeysQuery.isError ? (
                    <p className="py-6 text-sm text-signal-orange">Could not load API keys.</p>
                  ) : (apiKeysQuery.data ?? []).length === 0 ? (
                    <EmptyState
                      compact
                      eyebrow="No keys"
                      title="No API keys yet"
                      description="Create a named key for CI, then authenticate the CLI with badger login --token."
                      className="border-0 shadow-none"
                      footer={
                        <pre className="overflow-x-auto rounded-[3px] border border-ash-stroke bg-obsidian-canvas p-3 font-mono text-xs text-pale-stone">
                          {`badger login --token bgk_…`}
                        </pre>
                      }
                    />
                  ) : (
                    (apiKeysQuery.data ?? []).map((key) => (
                      <div
                        key={key.id}
                        className="flex flex-wrap items-center justify-between gap-3 border-b border-ash-stroke py-3 last:border-0"
                      >
                        <div className="min-w-0 space-y-1">
                          <p className="text-sm text-bone">{key.name}</p>
                          <p className="font-mono text-xs text-warm-granite">
                            {key.keyPrefix}… · last used{" "}
                            {key.lastUsedAt
                              ? new Date(key.lastUsedAt).toLocaleString()
                              : "never"}
                          </p>
                          {key.revokedAt ? <Badge variant="outline">revoked</Badge> : null}
                        </div>
                        {key.revokedAt === null ? (
                          <div className="flex flex-wrap gap-2">
                            <ConfirmAction
                              label="Rotate"
                              confirmLabel="Confirm rotate"
                              onConfirm={() => {
                                void (async () => {
                                  const token = await getAccessToken();
                                  if (token === null || workspaceId === undefined) {
                                    return;
                                  }
                                  try {
                                    const rotated = await rotateApiKey(
                                      token,
                                      workspaceId,
                                      key.id,
                                    );
                                    setCreatedApiToken(rotated.token);
                                    setError(null);
                                    await queryClient.invalidateQueries({
                                      queryKey: ["workspace", workspaceId, "api-keys"],
                                    });
                                  } catch (cause: unknown) {
                                    setError(
                                      cause instanceof Error
                                        ? cause.message
                                        : "Failed to rotate key",
                                    );
                                  }
                                })();
                              }}
                            />
                            <ConfirmAction
                              label="Revoke"
                              confirmLabel="Confirm revoke"
                              variant="destructive"
                              onConfirm={() => {
                                void (async () => {
                                  const token = await getAccessToken();
                                  if (token === null || workspaceId === undefined) {
                                    return;
                                  }
                                  try {
                                    await revokeApiKey(token, workspaceId, key.id);
                                    setError(null);
                                    await queryClient.invalidateQueries({
                                      queryKey: ["workspace", workspaceId, "api-keys"],
                                    });
                                  } catch (cause: unknown) {
                                    setError(
                                      cause instanceof Error
                                        ? cause.message
                                        : "Failed to revoke key",
                                    );
                                  }
                                })();
                              }}
                            />
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
      </section>
    </div>
  );
}
