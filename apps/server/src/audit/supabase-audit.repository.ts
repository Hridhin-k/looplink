import { Inject, Injectable, ServiceUnavailableException } from "@nestjs/common";

import { SUPABASE_CONFIG } from "../database/database.tokens.js";
import type { SupabaseConfig } from "../database/supabase.config.js";
import type { AuditRepository } from "./audit.repository.js";
import type { AuditEvent, AuditEventInput } from "./audit.types.js";

interface AuditEventRow {
  id: string;
  actor_user_id: string | null;
  workspace_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  metadata: Record<string, unknown> | null;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class SupabaseAuditRepository implements AuditRepository {
  constructor(
    @Inject(SUPABASE_CONFIG)
    private readonly config: SupabaseConfig,
  ) {}

  async append(event: AuditEventInput): Promise<AuditEvent> {
    const { baseUrl, serviceRoleKey } = this.requireConfig();
    const response = await fetch(`${baseUrl}/rest/v1/audit_events`, {
      method: "POST",
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        "Content-Type": "application/json",
        Prefer: "return=representation",
      },
      body: JSON.stringify({
        actor_user_id: event.actorUserId ?? null,
        workspace_id: event.workspaceId ?? null,
        action: event.action,
        resource_type: event.resourceType,
        resource_id: event.resourceId ?? null,
        metadata: event.metadata ?? {},
        ip_address: event.ipAddress ?? null,
        user_agent: event.userAgent ?? null,
      }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new Error(`Audit insert failed (${String(response.status)}): ${detail}`);
    }

    const rows = (await response.json()) as AuditEventRow[];
    const row = rows[0];
    if (row === undefined) {
      throw new Error("Audit insert returned no row.");
    }
    return mapRow(row);
  }

  private requireConfig(): { baseUrl: string; serviceRoleKey: string } {
    if (!this.config.enabled) {
      throw new ServiceUnavailableException("Audit unavailable: Supabase is not configured.");
    }
    return { baseUrl: this.config.url, serviceRoleKey: this.config.serviceRoleKey };
  }
}

function mapRow(row: AuditEventRow): AuditEvent {
  return {
    id: row.id,
    actorUserId: row.actor_user_id,
    workspaceId: row.workspace_id,
    action: row.action,
    resourceType: row.resource_type,
    resourceId: row.resource_id,
    metadata: row.metadata ?? {},
    ipAddress: row.ip_address,
    userAgent: row.user_agent,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
