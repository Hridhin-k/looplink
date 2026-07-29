import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  Optional,
  UnauthorizedException,
  forwardRef,
} from "@nestjs/common";

import { ApiKeyService } from "../../workspaces/api-keys/api-key.service.js";
import { isApiKeyToken } from "../../workspaces/workspace-crypto.js";
import { AuthService } from "../auth.service.js";
import type { AuthUser } from "../auth.types.js";
import { extractBearerToken } from "../extract-bearer-token.js";

/**
 * Nest request augmented with the verified user after the guard succeeds.
 */
export interface JwtAuthenticatedRequest {
  headers: {
    authorization?: string;
  };
  authUser?: AuthUser;
  accessToken?: string;
}

/**
 * Verifies `Authorization: Bearer <jwt|api-key>`.
 *
 * Attach with `@UseGuards(JwtAuthGuard)` on protected controllers/handlers.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly auth: AuthService,
    @Optional()
    @Inject(forwardRef(() => ApiKeyService))
    private readonly apiKeys?: ApiKeyService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<JwtAuthenticatedRequest>();
    const token = extractBearerToken(request.headers.authorization);
    if (token === undefined) {
      throw new UnauthorizedException("Missing Bearer access token.");
    }

    request.accessToken = token;
    request.authUser = await this.verifyBearer(token);
    return true;
  }

  private async verifyBearer(token: string): Promise<AuthUser> {
    if (isApiKeyToken(token)) {
      if (this.apiKeys === undefined) {
        throw new UnauthorizedException("API key authentication is unavailable.");
      }
      return this.apiKeys.verifyBearerToken(token);
    }

    const user = await this.auth.verifyAccessToken(token);
    return {
      ...user,
      authMethod: "jwt",
    };
  }
}
