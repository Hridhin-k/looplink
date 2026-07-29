export interface WorkspaceApiKey {
  readonly id: string;
  readonly workspaceId: string;
  readonly name: string;
  readonly keyPrefix: string;
  readonly createdByUserId: string;
  readonly lastUsedAt: string | null;
  readonly expiresAt: string | null;
  readonly revokedAt: string | null;
  readonly revokedByUserId: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface WorkspaceApiKeyRecord extends WorkspaceApiKey {
  readonly keyHash: string;
}

export interface CreatedWorkspaceApiKey {
  readonly apiKey: WorkspaceApiKey;
  /** Plaintext secret — returned once at creation or rotation. */
  readonly token: string;
}
