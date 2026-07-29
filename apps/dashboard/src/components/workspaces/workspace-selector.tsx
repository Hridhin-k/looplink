"use client";

import { PlusIcon } from "lucide-react";
import { useState, type FormEvent } from "react";

import { useWorkspace } from "@/components/providers/workspace-provider";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export function WorkspaceSelector() {
  const { activeWorkspace, memberships, setActiveWorkspaceId, createSharedWorkspace, isLoading } =
    useWorkspace();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");

  if (activeWorkspace === null) {
    return null;
  }

  const hasMultiple = memberships.length > 1;

  async function onCreate(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    const normalized = name.trim();
    if (normalized.length < 2) {
      return;
    }
    await createSharedWorkspace(normalized);
    setName("");
    setShowCreate(false);
  }

  return (
    <div className="hidden items-center gap-2 md:flex">
      <Select
        value={activeWorkspace.id}
        disabled={!hasMultiple || isLoading}
        onValueChange={(value) => setActiveWorkspaceId(String(value))}
      >
        <SelectTrigger size="sm" className="min-w-[180px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent align="end">
          {memberships.map((membership) => (
            <SelectItem key={membership.workspace.id} value={membership.workspace.id}>
              <span className="truncate">{membership.workspace.name}</span>
              {membership.workspace.kind === "personal" ? (
                <Badge variant="outline" className="ml-1">Personal</Badge>
              ) : null}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Button type="button" variant="outline" size="sm" onClick={() => setShowCreate((v) => !v)}>
        <PlusIcon className="size-3.5" />
        Workspace
      </Button>

      {showCreate ? (
        <form className="flex items-center gap-2" onSubmit={(e) => void onCreate(e)}>
          <Input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Workspace name"
            className="h-7 w-[180px]"
          />
          <Button type="submit" size="sm" disabled={isLoading || name.trim().length < 2}>
            Create
          </Button>
        </form>
      ) : null}
    </div>
  );
}
