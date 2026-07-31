import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";

import type { BadgerSupabaseClient } from "../database/create-supabase-clients.js";
import { SUPABASE_CONFIG, SUPABASE_SERVICE_ROLE_CLIENT } from "../database/database.tokens.js";
import type { SupabaseConfig } from "../database/supabase.config.js";
import type {
  AnonymousSessionRepository,
  CreateAnonymousSessionRecordInput,
} from "./anonymous-session.repository.js";
import type { AnonymousSession } from "./anonymous-session.types.js";

interface AnonymousSessionRow {
  id: string;
  session_token: string;
  created_at: string;
  expires_at: string;
  last_seen_at: string;
}

const SELECT =
  "id,session_token,created_at,expires_at,last_seen_at";

/**
 * Supabase-backed anonymous session repository.
 *
 * Stores a SHA-256 hash of the plaintext token in `session_token`.
 */
@Injectable()
export class SupabaseAnonymousSessionRepository implements AnonymousSessionRepository {
  constructor(
    @Inject(SUPABASE_CONFIG)
    private readonly config: SupabaseConfig,
    @Inject(SUPABASE_SERVICE_ROLE_CLIENT)
    private readonly serviceRole: BadgerSupabaseClient | null,
  ) {}

  async create(input: CreateAnonymousSessionRecordInput): Promise<AnonymousSession> {
    const rows = await this.requestJson<AnonymousSessionRow[]>(
      "POST",
      "/rest/v1/anonymous_sessions",
      {
        session_token: input.sessionTokenHash,
        expires_at: input.expiresAt,
      },
      { prefer: "return=representation" },
    );
    const row = rows[0];
    if (row === undefined) {
      throw new Error("Failed to create anonymous session.");
    }
    return mapRow(row);
  }

  async findByTokenHash(sessionTokenHash: string): Promise<AnonymousSession | undefined> {
    const encoded = encodeURIComponent(sessionTokenHash);
    const rows = await this.requestJson<AnonymousSessionRow[]>(
      "GET",
      `/rest/v1/anonymous_sessions?select=${SELECT}&session_token=eq.${encoded}&limit=1`,
    );
    const row = rows[0];
    return row === undefined ? undefined : mapRow(row);
  }

  async touch(id: string, lastSeenAt: string): Promise<AnonymousSession | undefined> {
    const encoded = encodeURIComponent(id);
    const rows = await this.requestJson<AnonymousSessionRow[]>(
      "PATCH",
      `/rest/v1/anonymous_sessions?id=eq.${encoded}`,
      { last_seen_at: lastSeenAt },
      { prefer: "return=representation" },
    );
    const row = rows[0];
    return row === undefined ? undefined : mapRow(row);
  }

  async deleteById(id: string): Promise<boolean> {
    const encoded = encodeURIComponent(id);
    await this.requestJson<unknown>("DELETE", `/rest/v1/anonymous_sessions?id=eq.${encoded}`);
    return true;
  }

  async deleteByTokenHash(sessionTokenHash: string): Promise<boolean> {
    const encoded = encodeURIComponent(sessionTokenHash);
    await this.requestJson<unknown>(
      "DELETE",
      `/rest/v1/anonymous_sessions?session_token=eq.${encoded}`,
    );
    return true;
  }

  async deleteExpired(nowIso: string): Promise<number> {
    const encoded = encodeURIComponent(nowIso);
    const rows = await this.requestJson<AnonymousSessionRow[]>(
      "DELETE",
      `/rest/v1/anonymous_sessions?expires_at=lte.${encoded}`,
      undefined,
      { prefer: "return=representation" },
    );
    return Array.isArray(rows) ? rows.length : 0;
  }

  private async requestJson<T>(
    method: string,
    path: string,
    body?: unknown,
    options: { readonly prefer?: string } = {},
  ): Promise<T> {
    if (!this.config.enabled || this.serviceRole === null) {
      throw new ServiceUnavailableException("Supabase is not configured.");
    }

    const headers: Record<string, string> = {
      apikey: this.config.serviceRoleKey,
      Authorization: `Bearer ${this.config.serviceRoleKey}`,
      Accept: "application/json",
    };
    if (options.prefer !== undefined) {
      headers["Prefer"] = options.prefer;
    }
    if (body !== undefined) {
      headers["Content-Type"] = "application/json";
    }

    const response = await fetch(`${this.config.url}${path}`, {
      method,
      headers,
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });

    if (!response.ok) {
      const detail = await response.text().catch(() => "");
      throw new Error(
        `Anonymous session request failed (${String(response.status)})${detail.length > 0 ? `: ${detail}` : "."}`,
      );
    }

    if (response.status === 204) {
      return [] as T;
    }

    return (await response.json()) as T;
  }
}

function mapRow(row: AnonymousSessionRow): AnonymousSession {
  return {
    id: row.id,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    lastSeenAt: row.last_seen_at,
  };
}
