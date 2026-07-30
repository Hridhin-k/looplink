/**
 * Append-only security / compliance event.
 */
export interface AuditEventInput {
  readonly actorUserId?: string | null;
  readonly workspaceId?: string | null;
  readonly action: string;
  readonly resourceType: string;
  readonly resourceId?: string | null;
  readonly metadata?: Record<string, unknown>;
  readonly ipAddress?: string | null;
  readonly userAgent?: string | null;
}

export interface AuditEvent extends AuditEventInput {
  readonly id: string;
  readonly createdAt: string;
  readonly updatedAt: string;
  readonly metadata: Record<string, unknown>;
}
