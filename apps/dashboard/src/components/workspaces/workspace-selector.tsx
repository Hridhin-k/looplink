"use client";

import { PlusIcon } from "lucide-react";
import { useMemo, useState, type FormEvent } from "react";

import { useWorkspace } from "@/components/providers/workspace-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { WorkspaceMembership } from "@/lib/workspaces/types";

/**
 * Top-nav workspace switcher.
 *
 * Groups Personal first, then Shared. Switching updates dashboard data via
 * React Query — no full page refresh.
 */
export function WorkspaceSelector() {
  const { activeWorkspace, memberships, setActiveWorkspaceId, createSharedWorkspace, isLoading } =
    useWorkspace();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const { personal, shared } = useMemo(() => partitionMemberships(memberships), [memberships]);

  if (activeWorkspace === null) {
    return (
      <div className="hidden h-7 w-[140px] animate-pulse rounded-[3px] bg-carbon-lift md:block" />
    );
  }

  const hasMultiple = memberships.length > 1;

  async function onCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const normalized = name.trim();
    if (normalized.length < 2) {
      return;
    }
    setError(null);
    setCreating(true);
    try {
      await createSharedWorkspace(normalized);
      setName("");
      setShowCreate(false);
    } catch (cause: unknown) {
      setError(cause instanceof Error ? cause.message : "Could not create workspace.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="flex items-center gap-2">
      <Select
        value={activeWorkspace.id}
        disabled={!hasMultiple || isLoading}
        onValueChange={(value) => setActiveWorkspaceId(String(value))}
      >
        <SelectTrigger size="sm" className="min-w-[140px] max-w-[200px] rounded-[3px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end" className="min-w-[200px]">
          {personal.length > 0 ? (
            <SelectGroup>
              <SelectLabel className="font-mono text-[11px] tracking-[0.12em] text-pale-stone uppercase">
                Personal
              </SelectLabel>
              {personal.map((membership) => (
                <SelectItem key={membership.workspace.id} value={membership.workspace.id}>
                  <span className="truncate">Personal</span>
                </SelectItem>
              ))}
            </SelectGroup>
          ) : null}

          {shared.length > 0 ? (
            <SelectGroup>
              <SelectLabel className="font-mono text-[11px] tracking-[0.12em] text-pale-stone uppercase">
                Shared Workspaces
              </SelectLabel>
              {shared.map((membership) => (
                <SelectItem key={membership.workspace.id} value={membership.workspace.id}>
                  <span className="truncate">{membership.workspace.name}</span>
                </SelectItem>
              ))}
            </SelectGroup>
          ) : null}
        </SelectContent>
      </Select>

      <Button
        type="button"
        variant="outline"
        size="sm"
        className="hidden rounded-[3px] sm:inline-flex"
        onClick={() => {
          setError(null);
          setShowCreate((v) => !v);
        }}
      >
        <PlusIcon className="size-3.5" />
        Workspace
      </Button>

      {showCreate ? (
        <form className="hidden items-center gap-2 sm:flex" onSubmit={(e) => void onCreate(e)}>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Workspace name"
            className="h-7 w-[160px] rounded-[3px]"
          />
          <Button
            type="submit"
            size="sm"
            className="rounded-[3px]"
            disabled={isLoading || creating || name.trim().length < 2}
          >
            Create
          </Button>
        </form>
      ) : null}

      {error !== null ? (
        <p className="hidden max-w-[160px] truncate text-xs text-signal-orange sm:inline" title={error}>
          {error}
        </p>
      ) : null}
    </div>
  );
}

function partitionMemberships(memberships: readonly WorkspaceMembership[]): {
  readonly personal: WorkspaceMembership[];
  readonly shared: WorkspaceMembership[];
} {
  const personal: WorkspaceMembership[] = [];
  const shared: WorkspaceMembership[] = [];
  for (const row of memberships) {
    if (row.workspace.kind === "personal") {
      personal.push(row);
    } else {
      shared.push(row);
    }
  }
  shared.sort((a, b) => a.workspace.name.localeCompare(b.workspace.name));
  return { personal, shared };
}
