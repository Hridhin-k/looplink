import {
  type CanActivate,
  type ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";

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
 * Verifies the `Authorization: Bearer <jwt>` header via Supabase Auth.
 *
 * Attach with `@UseGuards(JwtAuthGuard)` on protected controllers/handlers.
 */
@Injectable()
export class JwtAuthGuard implements CanActivate {
  /**
   * @param auth - Auth application service used for JWT verification.
   */
  constructor(private readonly auth: AuthService) {}

  /**
   * Validates the bearer token and attaches {@link AuthUser} to the request.
   *
   * @param context - Nest execution context.
   * @returns `true` when authentication succeeds.
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<JwtAuthenticatedRequest>();
    const token = extractBearerToken(request.headers.authorization);
    if (token === undefined) {
      throw new UnauthorizedException("Missing Bearer access token.");
    }

    const user = await this.auth.verifyAccessToken(token);
    request.authUser = user;
    request.accessToken = token;
    return true;
  }
}
