import { Injectable, type NestMiddleware, UnauthorizedException } from "@nestjs/common";
import type { IncomingMessage, ServerResponse } from "node:http";

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
 * HTTP middleware that requires and verifies a Bearer JWT.
 *
 * Applied to protected route prefixes (for example `/api/v1/me`). Controllers
 * still use {@link import("../guards/jwt-auth.guard.js").JwtAuthGuard} so
 * Nest handlers receive a typed `authUser`.
 */
@Injectable()
export class AuthMiddleware implements NestMiddleware {
  /**
   * @param auth - Auth application service used for JWT verification.
   */
  constructor(private readonly auth: AuthService) {}

  /**
   * Verifies the Authorization header before the route handler runs.
   *
   * @param req - Incoming HTTP request.
   * @param _res - Outgoing response (unused).
   * @param next - Continuation callback.
   */
  async use(
    req: AuthMiddlewareRequest,
    _res: ServerResponse,
    next: (error?: unknown) => void,
  ): Promise<void> {
    try {
      const raw = req.headers.authorization;
      const value = typeof raw === "string" ? raw : Array.isArray(raw) ? raw[0] : undefined;
      const token = extractBearerToken(value);
      if (token === undefined) {
        throw new UnauthorizedException("Missing Bearer access token.");
      }

      const user = await this.auth.verifyAccessToken(token);
      req.authUser = user;
      req.accessToken = token;
      next();
    } catch (error: unknown) {
      next(error);
    }
  }
}
