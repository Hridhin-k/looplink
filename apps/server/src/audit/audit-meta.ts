export interface RequestAuditMeta {
  readonly ipAddress?: string;
  readonly userAgent?: string;
}

export function toAuditFields(meta?: RequestAuditMeta): {
  ipAddress?: string | null;
  userAgent?: string | null;
} {
  return {
    ...(meta?.ipAddress !== undefined ? { ipAddress: meta.ipAddress } : {}),
    ...(meta?.userAgent !== undefined ? { userAgent: meta.userAgent } : {}),
  };
}
