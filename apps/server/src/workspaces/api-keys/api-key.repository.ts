import type { CreatedWorkspaceApiKey, WorkspaceApiKey, WorkspaceApiKeyRecord } from "./api-key.types.js";

export interface CreateApiKeyInput {
  readonly workspaceId: string;
  readonly name: string;
  readonly keyPrefix: string;
  readonly keyHash: string;
  readonly createdByUserId: string;
  readonly expiresAt: string | null;
}

export interface ApiKeyRepository {
  listForWorkspace(workspaceId: string): Promise<WorkspaceApiKey[]>;
  findById(workspaceId: string, keyId: string): Promise<WorkspaceApiKeyRecord | undefined>;
  findActiveByHash(keyHash: string): Promise<WorkspaceApiKeyRecord | undefined>;
  create(input: CreateApiKeyInput): Promise<WorkspaceApiKey>;
  rotate(
    keyId: string,
    material: { readonly keyPrefix: string; readonly keyHash: string },
  ): Promise<WorkspaceApiKey>;
  revoke(keyId: string, revokedByUserId: string): Promise<WorkspaceApiKey>;
  touchLastUsed(keyId: string): Promise<void>;
}

export type { CreatedWorkspaceApiKey, WorkspaceApiKey, WorkspaceApiKeyRecord };
