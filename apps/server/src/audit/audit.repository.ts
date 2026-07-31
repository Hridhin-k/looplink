import type { AuditEvent, AuditEventInput } from "./audit.types.js";

export interface AuditRepository {
  append(event: AuditEventInput): Promise<AuditEvent>;
}
