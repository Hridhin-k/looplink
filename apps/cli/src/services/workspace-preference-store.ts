import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

interface StoredWorkspacePreference {
  readonly serverUrl: string;
  readonly workspaceId: string;
  readonly workspaceName?: string;
}

/**
 * Persists the CLI "current workspace" preference independently of auth.
 *
 * Switching workspace never changes tokens or requires re-login.
 */
export class WorkspacePreferenceStore {
  private readonly filePath: string;

  constructor() {
    this.filePath = join(homedir(), ".config", "badger", "workspace.json");
  }

  load(serverUrl: string): StoredWorkspacePreference | undefined {
    const stored = this.read();
    if (stored === undefined || stored.serverUrl !== serverUrl) {
      return undefined;
    }
    return stored;
  }

  save(serverUrl: string, workspaceId: string, workspaceName?: string): void {
    const payload: StoredWorkspacePreference = {
      serverUrl,
      workspaceId,
      ...(workspaceName === undefined ? {} : { workspaceName }),
    };
    const parent = dirname(this.filePath);
    if (!existsSync(parent)) {
      mkdirSync(parent, { recursive: true, mode: 0o700 });
    }
    writeFileSync(this.filePath, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
    chmodSync(this.filePath, 0o600);
  }

  clear(): void {
    try {
      writeFileSync(this.filePath, "", { mode: 0o600 });
    } catch {
      // no-op
    }
  }

  private read(): StoredWorkspacePreference | undefined {
    try {
      if (!existsSync(this.filePath)) {
        return undefined;
      }
      const raw = readFileSync(this.filePath, "utf8").trim();
      if (raw.length === 0) {
        return undefined;
      }
      const parsed = JSON.parse(raw) as Partial<StoredWorkspacePreference>;
      if (
        typeof parsed.serverUrl !== "string" ||
        typeof parsed.workspaceId !== "string" ||
        parsed.workspaceId.trim().length === 0
      ) {
        return undefined;
      }
      return {
        serverUrl: parsed.serverUrl,
        workspaceId: parsed.workspaceId,
        ...(typeof parsed.workspaceName === "string" ? { workspaceName: parsed.workspaceName } : {}),
      };
    } catch {
      return undefined;
    }
  }
}
