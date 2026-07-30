import { Inject, Injectable, Optional } from "@nestjs/common";

import { SUPABASE_CONFIG } from "../database/database.tokens.js";
import type { SupabaseConfig } from "../database/supabase.config.js";
import { StructuredLogger } from "../observability/structured-logger.js";
import type { AuditRepository } from "./audit.repository.js";
import { AUDIT_REPOSITORY } from "./audit.tokens.js";
import type { AuditEvent, AuditEventInput } from "./audit.types.js";

/**
 * Best-effort audit logger. Failures never break the primary request path.
 */
@Injectable()
export class AuditService {
  constructor(
    @Inject(AUDIT_REPOSITORY) private readonly repository: AuditRepository,
    private readonly logger: StructuredLogger,
    @Optional() @Inject(SUPABASE_CONFIG) private readonly config?: SupabaseConfig,
  ) {}

  async record(event: AuditEventInput): Promise<void> {
    try {
      if (this.config !== undefined && !this.config.enabled) {
        this.logger.debug("audit.skipped", { action: event.action, reason: "supabase_disabled" });
        return;
      }
      const saved = await this.repository.append(event);
      this.logger.log("audit.recorded", {
        action: saved.action,
        resourceType: saved.resourceType,
        resourceId: saved.resourceId ?? null,
        actorUserId: saved.actorUserId ?? null,
        workspaceId: saved.workspaceId ?? null,
      });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : String(error);
      this.logger.warn("audit.failed", { action: event.action, error: message });
    }
  }

  async recordOrThrow(event: AuditEventInput): Promise<AuditEvent> {
    return this.repository.append(event);
  }
}
