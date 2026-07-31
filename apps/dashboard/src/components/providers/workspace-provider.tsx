"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { useMutation, useQuery, useQueryClient, keepPreviousData } from "@tanstack/react-query";

import { useAuth } from "@/components/providers/auth-provider";
import {
  createWorkspace,
  resolveWorkspaceContext,
} from "@/lib/workspaces/api";
import type { Workspace, WorkspaceMembership } from "@/lib/workspaces/types";

const ACTIVE_WORKSPACE_KEY = "badger.activeWorkspaceId";

function readStoredWorkspaceId(): string | null {
  if (typeof window === "undefined") {
    return null;
  }
  return window.localStorage.getItem(ACTIVE_WORKSPACE_KEY);
}

function writeStoredWorkspaceId(workspaceId: string): void {
  window.localStorage.setItem(ACTIVE_WORKSPACE_KEY, workspaceId);
}

function clearStoredWorkspaceId(): void {
  window.localStorage.removeItem(ACTIVE_WORKSPACE_KEY);
}

interface WorkspaceContextValue {
  readonly isLoading: boolean;
  readonly memberships: WorkspaceMembership[];
  readonly activeWorkspace: Workspace | null;
  readonly activeRole: WorkspaceMembership["role"] | null;
  readonly setActiveWorkspaceId: (workspaceId: string) => void;
  readonly createSharedWorkspace: (name: string) => Promise<void>;
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null);

export function WorkspaceProvider({ children }: { readonly children: ReactNode }) {
  const queryClient = useQueryClient();
  const { session, getAccessToken } = useAuth();
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState<string | null>(() =>
    readStoredWorkspaceId(),
  );

  useEffect(() => {
    if (session === null) {
      clearStoredWorkspaceId();
      setSelectedWorkspaceId(null);
    }
  }, [session]);

  const contextQuery = useQuery({
    queryKey: ["workspace", "context", selectedWorkspaceId],
    enabled: session !== null,
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const token = await getAccessToken();
      if (token === null) {
        throw new Error("Not authenticated");
      }
      return resolveWorkspaceContext(token, selectedWorkspaceId ?? undefined);
    },
  });

  useEffect(() => {
    const active = contextQuery.data?.activeWorkspace;
    if (!active) {
      return;
    }
    writeStoredWorkspaceId(active.id);
    if (selectedWorkspaceId !== active.id) {
      setSelectedWorkspaceId(active.id);
    }
  }, [contextQuery.data?.activeWorkspace, selectedWorkspaceId]);

  const createMutation = useMutation({
    mutationFn: async (name: string) => {
      const token = await getAccessToken();
      if (token === null) {
        throw new Error("Not authenticated");
      }
      return createWorkspace(token, name);
    },
    onSuccess: async (workspace) => {
      setSelectedWorkspaceId(workspace.id);
      writeStoredWorkspaceId(workspace.id);
      await queryClient.invalidateQueries({ queryKey: ["workspace"] });
      await queryClient.invalidateQueries({ queryKey: ["inspector"] });
    },
  });

  const setActiveWorkspaceId = useCallback(
    (workspaceId: string) => {
      setSelectedWorkspaceId(workspaceId);
      writeStoredWorkspaceId(workspaceId);
      void queryClient.invalidateQueries({ queryKey: ["inspector"] });
    },
    [queryClient],
  );

  const createSharedWorkspace = useCallback(
    async (name: string): Promise<void> => {
      await createMutation.mutateAsync(name);
    },
    [createMutation],
  );

  const value = useMemo<WorkspaceContextValue>(() => {
    const active = contextQuery.data?.activeWorkspace ?? null;
    const memberships = sortMemberships(contextQuery.data?.memberships ?? []);
    const activeRole =
      active === null
        ? null
        : (memberships.find((m) => m.workspace.id === active.id)?.role ?? null);
    return {
      isLoading: (contextQuery.isLoading && !contextQuery.isPlaceholderData) || createMutation.isPending,
      memberships,
      activeWorkspace: active,
      activeRole,
      setActiveWorkspaceId,
      createSharedWorkspace,
    };
  }, [
    contextQuery.data?.activeWorkspace,
    contextQuery.data?.memberships,
    contextQuery.isLoading,
    contextQuery.isPlaceholderData,
    createMutation.isPending,
    setActiveWorkspaceId,
    createSharedWorkspace,
  ]);

  return <WorkspaceContext.Provider value={value}>{children}</WorkspaceContext.Provider>;
}

export function useWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceContext);
  if (value === null) {
    throw new Error("useWorkspace must be used within WorkspaceProvider.");
  }
  return value;
}

function sortMemberships(memberships: readonly WorkspaceMembership[]): WorkspaceMembership[] {
  return [...memberships].sort((a, b) => {
    if (a.workspace.kind !== b.workspace.kind) {
      return a.workspace.kind === "personal" ? -1 : 1;
    }
    return a.workspace.name.localeCompare(b.workspace.name);
  });
}
