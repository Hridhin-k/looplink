import { Inject, Injectable, Logger, Optional } from "@nestjs/common";

import type { BadgerSupabaseClient } from "../database/create-supabase-clients.js";
import { SUPABASE_CONFIG, SUPABASE_SERVICE_ROLE_CLIENT } from "../database/database.tokens.js";
import type { SupabaseConfig } from "../database/supabase.config.js";
import {
  contextAnonymousSessionId,
  contextWorkspaceId,
  type TunnelOwnership,
} from "./tunnel-context.js";

/**
 * Best-effort persistence of tunnel ownership rows (XOR constraint in Postgres).
 *
 * Live routing remains in-memory; this mirrors ownership for audits / future phases.
 * Failures are logged and never block the data plane.
 */
@Injectable()
export class TunnelOwnershipStore {
  private readonly logger = new Logger(TunnelOwnershipStore.name);

  constructor(
    @Inject(SUPABASE_CONFIG)
    private readonly config: SupabaseConfig,
    @Optional()
    @Inject(SUPABASE_SERVICE_ROLE_CLIENT)
    private readonly serviceRole: BadgerSupabaseClient | null,
  ) {}

  upsert(tunnelId: string, port: number, context: TunnelOwnership): void {
    if (!this.config.enabled || this.serviceRole === null) {
      return;
    }

    const anonymousSessionId = contextAnonymousSessionId(context) ?? null;
    const workspaceId = contextWorkspaceId(context) ?? null;

    void this.request("POST", "/rest/v1/tunnels?on_conflict=id", {
      id: tunnelId,
      port,
      anonymous_session_id: anonymousSessionId,
      workspace_id: workspaceId,
    }, { prefer: "resolution=merge-duplicates,return=minimal" }).catch((error: unknown) => {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to persist tunnel ownership (${tunnelId}): ${detail}`);
    });
  }

  remove(tunnelId: string): void {
    if (!this.config.enabled || this.serviceRole === null) {
      return;
    }

    const encoded = encodeURIComponent(tunnelId);
    void this.request("DELETE", `/rest/v1/tunnels?id=eq.${encoded}`).catch((error: unknown) => {
      const detail = error instanceof Error ? error.message : String(error);
      this.logger.warn(`Failed to delete tunnel ownership (${tunnelId}): ${detail}`);
    });
  }

  private async request(
    method: string,
    path: string,
    body?: unknown,
    options: { readonly prefer?: string } = {},
  ): Promise<void> {
    if (!this.config.enabled || this.serviceRole === null) {
      return;
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
        `Tunnel ownership request failed (${String(response.status)})${detail.length > 0 ? `: ${detail}` : "."}`,
      );
    }
  }
}
