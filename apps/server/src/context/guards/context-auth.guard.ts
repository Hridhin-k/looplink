import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { Reflector } from "@nestjs/core";

import type { AuthUser } from "../../auth/auth.types.js";
import type { WorkspacePermission } from "../../workspaces/workspace.permissions.js";
import { ContextResolver } from "../context.resolver.js";
import { TUNNEL_CONTEXT_REQUEST_KEY } from "../decorators/current-tunnel-context.decorator.js";

export const REQUIRED_CONTEXT_PERMISSION_KEY = "badgerRequiredContextPermission";

/**
 * Resolves {@link import("../tunnel-context.interface.js").TunnelContext} for
 * authenticated HTTP requests and optionally enforces a permission.
 *
 * Attach with `@UseGuards(JwtAuthGuard, ContextAuthGuard)` and optionally
 * `@RequireContextPermission("inspector:read")`.
 */
@Injectable()
export class ContextAuthGuard implements CanActivate {
  constructor(
    private readonly resolver: ContextResolver,
    private readonly reflector: Reflector,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<{
      user?: AuthUser;
      headers: Record<string, string | string[] | undefined>;
      [TUNNEL_CONTEXT_REQUEST_KEY]?: import("../tunnel-context.interface.js").TunnelContext;
    }>();

    const user = request.user;
    if (user === undefined) {
      throw new UnauthorizedException("Authentication required.");
    }

    const workspaceHeader = headerValue(request.headers["x-workspace-id"]);
    const tunnelContext = await this.resolver.resolveAuthenticated(user, workspaceHeader, {
      metadata: { transport: "http" },
    });

    const permission = this.reflector.getAllAndOverride<WorkspacePermission | undefined>(
      REQUIRED_CONTEXT_PERMISSION_KEY,
      [context.getHandler(), context.getClass()],
    );
    if (permission !== undefined) {
      this.resolver.requirePermission(tunnelContext, permission);
    }

    request[TUNNEL_CONTEXT_REQUEST_KEY] = tunnelContext;
    return true;
  }
}

function headerValue(value: string | string[] | undefined): string | undefined {
  if (typeof value === "string") {
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }
  if (Array.isArray(value)) {
    const first = value[0]?.trim();
    return first !== undefined && first.length > 0 ? first : undefined;
  }
  return undefined;
}
