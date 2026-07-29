import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";

import type { AuthUser } from "../../auth/auth.types.js";
import { generateApiKeyMaterial, hashSecret, isApiKeyToken } from "../workspace-crypto.js";
import { WorkspaceService } from "../workspace.service.js";
import type { ApiKeyRepository } from "./api-key.repository.js";
import { API_KEY_REPOSITORY } from "./api-key.tokens.js";
import type { CreatedWorkspaceApiKey, WorkspaceApiKey } from "./api-key.types.js";

@Injectable()
export class ApiKeyService {
  constructor(
    @Inject(API_KEY_REPOSITORY)
    private readonly apiKeys: ApiKeyRepository,
    private readonly workspaces: WorkspaceService,
  ) {}

  async list(user: AuthUser, workspaceId: string): Promise<WorkspaceApiKey[]> {
    await this.requireManage(user, workspaceId);
    return this.apiKeys.listForWorkspace(workspaceId);
  }

  async create(
    user: AuthUser,
    workspaceId: string,
    name: string,
    expiresAt: string | null,
  ): Promise<CreatedWorkspaceApiKey> {
    await this.requireManage(user, workspaceId);
    const normalized = name.trim();
    if (normalized.length < 2) {
      throw new BadRequestException("API key name must be at least 2 characters.");
    }
    if (expiresAt !== null && Number.isNaN(Date.parse(expiresAt))) {
      throw new BadRequestException("expiresAt must be a valid ISO timestamp.");
    }

    const material = generateApiKeyMaterial();
    const apiKey = await this.apiKeys.create({
      workspaceId,
      name: normalized,
      keyPrefix: material.keyPrefix,
      keyHash: material.keyHash,
      createdByUserId: user.id,
      expiresAt,
    });

    return { apiKey, token: material.plaintext };
  }

  async rotate(user: AuthUser, workspaceId: string, keyId: string): Promise<CreatedWorkspaceApiKey> {
    await this.requireManage(user, workspaceId);
    const existing = await this.apiKeys.findById(workspaceId, keyId);
    if (existing === undefined) {
      throw new NotFoundException("API key not found.");
    }
    if (existing.revokedAt !== null) {
      throw new BadRequestException("Cannot rotate a revoked API key.");
    }

    const material = generateApiKeyMaterial();
    const apiKey = await this.apiKeys.rotate(keyId, {
      keyPrefix: material.keyPrefix,
      keyHash: material.keyHash,
    });
    return { apiKey, token: material.plaintext };
  }

  async revoke(user: AuthUser, workspaceId: string, keyId: string): Promise<WorkspaceApiKey> {
    await this.requireManage(user, workspaceId);
    const existing = await this.apiKeys.findById(workspaceId, keyId);
    if (existing === undefined) {
      throw new NotFoundException("API key not found.");
    }
    if (existing.revokedAt !== null) {
      return {
        id: existing.id,
        workspaceId: existing.workspaceId,
        name: existing.name,
        keyPrefix: existing.keyPrefix,
        createdByUserId: existing.createdByUserId,
        lastUsedAt: existing.lastUsedAt,
        expiresAt: existing.expiresAt,
        revokedAt: existing.revokedAt,
        revokedByUserId: existing.revokedByUserId,
        createdAt: existing.createdAt,
        updatedAt: existing.updatedAt,
      };
    }
    return this.apiKeys.revoke(keyId, user.id);
  }

  /**
   * Verifies a plaintext API key Bearer token.
   * Updates last_used_at asynchronously for audit metadata.
   */
  async verifyBearerToken(token: string): Promise<AuthUser> {
    if (!isApiKeyToken(token)) {
      throw new UnauthorizedException("Invalid API key.");
    }

    const record = await this.apiKeys.findActiveByHash(hashSecret(token.trim()));
    if (record === undefined) {
      throw new UnauthorizedException("Invalid API key.");
    }
    if (record.expiresAt !== null && new Date(record.expiresAt).getTime() < Date.now()) {
      throw new UnauthorizedException("API key has expired.");
    }

    void this.apiKeys.touchLastUsed(record.id).catch(() => undefined);

    return {
      id: record.createdByUserId,
      email: null,
      authMethod: "api_key",
      workspaceId: record.workspaceId,
      apiKeyId: record.id,
    };
  }

  private async requireManage(user: AuthUser, workspaceId: string): Promise<void> {
    if (user.authMethod === "api_key") {
      throw new ForbiddenException("API keys cannot manage other API keys.");
    }
    await this.workspaces.assertPermission(workspaceId, user.id, "workspace:manage_api_keys");
  }
}
