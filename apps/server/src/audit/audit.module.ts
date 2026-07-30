import { Global, Module } from "@nestjs/common";

import { AuditService } from "./audit.service.js";
import { AUDIT_REPOSITORY } from "./audit.tokens.js";
import { SupabaseAuditRepository } from "./supabase-audit.repository.js";

@Global()
@Module({
  providers: [
    AuditService,
    SupabaseAuditRepository,
    { provide: AUDIT_REPOSITORY, useExisting: SupabaseAuditRepository },
  ],
  exports: [AuditService],
})
export class AuditModule {}
