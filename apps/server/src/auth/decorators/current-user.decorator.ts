import {
  createParamDecorator,
  type ExecutionContext,
  UnauthorizedException,
} from "@nestjs/common";

import type { AuthUser } from "../auth.types.js";

/**
 * Nest request shape after {@link import("../guards/jwt-auth.guard.js").JwtAuthGuard} runs.
 */
interface RequestWithAuthUser {
  readonly authUser?: AuthUser;
}

/**
 * Injects the authenticated {@link AuthUser} from the request.
 *
 * Requires {@link import("../guards/jwt-auth.guard.js").JwtAuthGuard}.
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const request = context.switchToHttp().getRequest<RequestWithAuthUser>();
    const user = request.authUser;
    if (user === undefined) {
      throw new UnauthorizedException("Authentication required.");
    }
    return user;
  },
);
