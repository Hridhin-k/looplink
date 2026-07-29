import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";

import { SUPABASE_CONFIG } from "../../database/database.tokens.js";
import type { SupabaseConfig } from "../../database/supabase.config.js";
import type { WorkspaceApiKey, WorkspaceApiKeyRecord } from "./api-key.types.js";
import type { ApiKeyRepository, CreateApiKeyInput } from "./api-key.repository.js";

interface ApiKeyRow {
  id: string;
  workspace_id: string;
  name: string;
  key_prefix: string;
  key_hash: string;
  created_by_user_id: string;
  last_used_at: string | null;
  expires_at: string | null;
  revoked_at: string | null;
  revoked_by_user_id: string | null;
  created_at: string;
  updated_at: string;
}

const API_KEY_SELECT =
  "id,workspace_id,name,key_prefix,key_hash,created_by_user_id,last_used_at,expires_at,revoked_at,revoked_by_user_id,created_at,updated_at";

@Injectable()
export class SupabaseApiKeyRepository implements ApiKeyRepository {
  constructor(
    @Inject(SUPABASE_CONFIG)
    private readonly config: SupabaseConfig,
  ) {}

  async listForWorkspace(workspaceId: string): Promise<WorkspaceApiKey[]> {
    const encoded = encodeURIComponent(workspaceId);
    const rows = await this.requestJson<ApiKeyRow[]>(
      "GET",
      `/rest/v1/workspace_api_keys?select=${API_KEY_SELECT}&workspace_id=eq.${encoded}&order=created_at.desc`,
    );
    return rows.map(mapApiKeyPublic);
  }

  async findById(workspaceId: string, keyId: string): Promise<WorkspaceApiKeyRecord | undefined> {
    const encodedWorkspaceId = encodeURIComponent(workspaceId);
    const encodedKeyId = encodeURIComponent(keyId);
    const rows = await this.requestJson<ApiKeyRow[]>(
      "GET",
      `/rest/v1/workspace_api_keys?select=${API_KEY_SELECT}&workspace_id=eq.${encodedWorkspaceId}&id=eq.${encodedKeyId}&limit=1`,
    );
    const row = rows[0];
    return row === undefined ? undefined : mapApiKeyRecord(row);
  }

  async findActiveByHash(keyHash: string): Promise<WorkspaceApiKeyRecord | undefined> {
    const encoded = encodeURIComponent(keyHash);
    const rows = await this.requestJson<ApiKeyRow[]>(
      "GET",
      `/rest/v1/workspace_api_keys?select=${API_KEY_SELECT}&key_hash=eq.${encoded}&revoked_at=is.null&limit=1`,
    );
    const row = rows[0];
    return row === undefined ? undefined : mapApiKeyRecord(row);
  }

  async create(input: CreateApiKeyInput): Promise<WorkspaceApiKey> {
    const rows = await this.requestJson<ApiKeyRow[]>(
      "POST",
      "/rest/v1/workspace_api_keys",
      {
        workspace_id: input.workspaceId,
        name: input.name,
        key_prefix: input.keyPrefix,
        key_hash: input.keyHash,
        created_by_user_id: input.createdByUserId,
        expires_at: input.expiresAt,
      },
      { prefer: "return=representation" },
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error("Failed to create API key.");
    }
    return mapApiKeyPublic(row);
  }

  async rotate(
    keyId: string,
    material: { readonly keyPrefix: string; readonly keyHash: string },
  ): Promise<WorkspaceApiKey> {
    const encoded = encodeURIComponent(keyId);
    const rows = await this.requestJson<ApiKeyRow[]>(
      "PATCH",
      `/rest/v1/workspace_api_keys?id=eq.${encoded}`,
      {
        key_prefix: material.keyPrefix,
        key_hash: material.keyHash,
        revoked_at: null,
        revoked_by_user_id: null,
      },
      { prefer: "return=representation" },
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error("Failed to rotate API key.");
    }
    return mapApiKeyPublic(row);
  }

  async revoke(keyId: string, revokedByUserId: string): Promise<WorkspaceApiKey> {
    const encoded = encodeURIComponent(keyId);
    const rows = await this.requestJson<ApiKeyRow[]>(
      "PATCH",
      `/rest/v1/workspace_api_keys?id=eq.${encoded}`,
      {
        revoked_at: new Date().toISOString(),
        revoked_by_user_id: revokedByUserId,
      },
      { prefer: "return=representation" },
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error("Failed to revoke API key.");
    }
    return mapApiKeyPublic(row);
  }

  async touchLastUsed(keyId: string): Promise<void> {
    const encoded = encodeURIComponent(keyId);
    await this.requestJson(
      "PATCH",
      `/rest/v1/workspace_api_keys?id=eq.${encoded}`,
      { last_used_at: new Date().toISOString() },
      { prefer: "return=minimal" },
    );
  }

  private requireConfig(): { baseUrl: string; serviceRoleKey: string } {
    if (!this.config.enabled) {
      throw new ServiceUnavailableException("API keys unavailable: Supabase is not configured.");
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
      throw new Error(`API key query failed (${String(response.status)}): ${detail}`);
    }

    const contentType = response.headers.get("content-type") ?? "";
    if (!contentType.includes("application/json")) {
      return [] as T;
    }
    return (await response.json()) as T;
  }
}

function mapApiKeyPublic(row: ApiKeyRow): WorkspaceApiKey {
  return {
    id: row.id,
    workspaceId: row.workspace_id,
    name: row.name,
    keyPrefix: row.key_prefix,
    createdByUserId: row.created_by_user_id,
    lastUsedAt: row.last_used_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at,
    revokedByUserId: row.revoked_by_user_id,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function mapApiKeyRecord(row: ApiKeyRow): WorkspaceApiKeyRecord {
  return {
    ...mapApiKeyPublic(row),
    keyHash: row.key_hash,
  };
}
