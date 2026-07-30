import {
  Inject,
  Injectable,
  Optional,
  type NestMiddleware,
  UnauthorizedException,
  forwardRef,
} from "@nestjs/common";
import type { IncomingMessage, ServerResponse } from "node:http";

import { ApiKeyService } from "../../workspaces/api-keys/api-key.service.js";
import { isApiKeyToken } from "../../workspaces/workspace-crypto.js";
import { ACCESS_COOKIE, parseCookies } from "../auth-cookies.js";
import { AuthService } from "../auth.service.js";
import type { AuthUser } from "../auth.types.js";
import { extractBearerToken } from "../extract-bearer-token.js";

/**
 * Incoming message augmented with verified auth fields.
 */
export interface AuthMiddlewareRequest extends IncomingMessage {
  authUser?: AuthUser;
  accessToken?: string;
}

/**
 * HTTP middleware that requires and verifies a Bearer JWT or API key.
 *
 * Applied to protected route prefixes (for example `/api/v1/me`). Controllers
 * still use {@link import("../guards/jwt-auth.guard.js").JwtAuthGuard} so
 * Nest handlers receive a typed `authUser`.
 */
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  constructor(
    private readonly auth: AuthService,
    @Optional()
    @Inject(forwardRef(() => ApiKeyService))
    private readonly apiKeys?: ApiKeyService,
  ) {}

  async use(
    req: AuthMiddlewareRequest,
    _res: ServerResponse,
    next: (error?: unknown) => void,
  ): Promise<void> {
    if (req.method === "OPTIONS") {
      next();
      return;
    }

    try {
      const raw = req.headers.authorization;
      const value = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
      const bearer = extractBearerToken(value);
      const cookieHeader = req.headers.cookie;
      const cookies = parseCookies(
        typeof cookieHeader === "string"
          ? cookieHeader
          : Array.isArray(cookieHeader)
            ? cookieHeader[0]
            : undefined,
      );
      const cookieToken = cookies[ACCESS_COOKIE];
      const token =
        bearer ??
        (cookieToken !== undefined && cookieToken.length > 0 ? cookieToken : undefined);
      if (token === undefined) {
        throw new UnauthorizedException("Missing Bearer access token.");
      }

      req.accessToken = token;
      if (isApiKeyToken(token)) {
        if (this.apiKeys === undefined) {
          throw new UnauthorizedException("API key authentication is unavailable.");
        }
        req.authUser = await this.apiKeys.verifyBearerToken(token);
      } else {
        const user = await this.auth.verifyAccessToken(token);
        req.authUser = { ...user, authMethod: "jwt" };
      }
      next();
    } catch (error: unknown) {
      next(error);
    }
  }
}
