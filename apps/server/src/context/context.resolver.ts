import {
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import type { IncomingMessage } from "node:http";

import { WorkspaceContextService } from "../access/workspace-context.service.js";
import { AuthService } from "../auth/auth.service.js";
import type { AuthUser } from "../auth/auth.types.js";
import { extractBearerToken } from "../auth/extract-bearer-token.js";
import { AnonymousSessionService } from "../tunnel/anonymous-session.service.js";
import type { WorkspacePermission } from "../workspaces/workspace.permissions.js";
import { ApiKeyService } from "../workspaces/api-keys/api-key.service.js";
import { isApiKeyToken } from "../workspaces/workspace-crypto.js";
import { ContextFactory } from "./context.factory.js";
import {
  contextHasPermission,
  type TunnelContext,
} from "./tunnel-context.interface.js";

/**
 * Transport credentials for resolving a {@link TunnelContext}.
 */
export interface ContextResolveInput {
  /** Bearer access token or API key (without the `Bearer ` prefix). */
  readonly accessToken?: string;
  /** Raw `Authorization` header (used to detect malformed Bearer). */
  readonly authorizationHeader?: string;
  /** Anonymous session token (`bga_…`). */
  readonly anonymousSessionToken?: string;
  /** Client workspace preference (header / query / path) — never trusted alone. */
  readonly requestedWorkspaceId?: string;
  /** Optional tunnel id already known for this session. */
  readonly tunnelId?: string | null;
  /** Extra metadata merged into the context. */
  readonly metadata?: Readonly<Record<string, string | number | boolean | null>>;
}

/**
 * Single source of truth for request identity, authorization, and execution context.
 *
 * Hides JWT / API-key / anonymous session / membership details from business services.
 */
@Injectable()
export class ContextResolver {
  constructor(
    private readonly factory: ContextFactory,
    private readonly auth: AuthService,
    private readonly apiKeys: ApiKeyService,
    private readonly workspaceContext: WorkspaceContextService,
    private readonly anonymousSessions: AnonymousSessionService,
  ) {}

  /**
   * Resolves context for an already-authenticated HTTP principal.
   *
   * Used by controllers after {@link import("../auth/guards/jwt-auth.guard.js").JwtAuthGuard}.
   */
  async resolveAuthenticated(
    user: AuthUser,
    requestedWorkspaceId: string | undefined,
    options: {
      readonly tunnelId?: string | null;
      readonly metadata?: ContextResolveInput["metadata"];
    } = {},
  ): Promise<TunnelContext> {
    const authorized = await this.workspaceContext.resolve(user, requestedWorkspaceId);
    const execution = this.factory.createWorkspace({
      accountId: authorized.request.accountId,
      workspaceId: authorized.request.workspaceId,
      membershipId: authorized.request.membershipId,
      role: authorized.request.role,
      permissions: authorized.request.permissions,
      tunnelId: options.tunnelId ?? null,
      metadata: {
        authMethod: authorized.request.authMethod,
        accountId: authorized.request.accountId,
        ...(authorized.request.apiKeyId === undefined
          ? {}
          : { apiKeyId: authorized.request.apiKeyId }),
        ...(options.metadata ?? {}),
      },
    });
    return this.factory.toTunnelContext(execution);
  }

  /**
   * Resolves context from raw transport credentials (CLI tunnel WebSocket, etc.).
   */
  async resolve(input: ContextResolveInput): Promise<TunnelContext> {
    if (input.authorizationHeader !== undefined && input.accessToken === undefined) {
      throw new UnauthorizedException("Malformed Authorization header.");
    }

    if (input.accessToken !== undefined) {
      const user = await this.verifyAccessToken(input.accessToken);
      return this.resolveAuthenticated(user, input.requestedWorkspaceId, {
        tunnelId: input.tunnelId ?? null,
        metadata: input.metadata,
      });
    }

    if (input.anonymousSessionToken !== undefined) {
      const session = await this.anonymousSessions.validate(input.anonymousSessionToken);
      const expiresAt = Date.parse(session.expiresAt);
      const execution = this.factory.createAnonymous({
        anonymousSessionId: session.id,
        expiresAt: Number.isFinite(expiresAt) ? expiresAt : Date.now() + 86_400_000,
        createdAt: Date.parse(session.createdAt) || Date.now(),
        tunnelId: input.tunnelId ?? null,
        metadata: {
          ...(input.metadata ?? {}),
        },
      });
      return this.factory.toTunnelContext(execution);
    }

    throw new UnauthorizedException("Authentication required.");
  }

  /**
   * Resolves tunnel WebSocket admission from the upgrade request.
   */
  async resolveTunnelWebSocket(request: IncomingMessage): Promise<TunnelContext> {
    const header = request.headers.authorization;
    const authorization = typeof header === "string" ? header : header?.[0];
    const accessToken = extractBearerToken(authorization);
    const requestedWorkspaceId = readHeader(request, "x-workspace-id");
    const anonymousSessionToken = readHeader(request, "x-anonymous-session");

    return this.resolve({
      ...(authorization === undefined ? {} : { authorizationHeader: authorization }),
      ...(accessToken === undefined ? {} : { accessToken }),
      ...(requestedWorkspaceId === undefined ? {} : { requestedWorkspaceId }),
      ...(anonymousSessionToken === undefined ? {} : { anonymousSessionToken }),
      metadata: { transport: "tunnel_ws" },
    });
  }

  /**
   * Resolves dashboard WebSocket admission from the upgrade request.
   */
  async resolveDashboardWebSocket(request: IncomingMessage): Promise<TunnelContext> {
    const accessToken = readAccessTokenFromRequest(request);
    if (accessToken === undefined) {
      throw new UnauthorizedException("Authentication required.");
    }

    const requestedWorkspaceId = readWorkspaceQuery(request);
    return this.resolve({
      accessToken,
      ...(requestedWorkspaceId === undefined ? {} : { requestedWorkspaceId }),
      metadata: { transport: "dashboard_ws" },
    });
  }

  /**
   * Ensures the context carries `permission` (resolved once at admission).
   */
  requirePermission(context: TunnelContext, permission: WorkspacePermission): void {
    if (!contextHasPermission(context, permission)) {
      throw new ForbiddenException(`Missing permission "${permission}".`);
    }
  }

  /**
   * Verifies a Bearer token without resolving workspace membership.
   */
  async verifyAccessToken(token: string): Promise<AuthUser> {
    if (isApiKeyToken(token)) {
      return this.apiKeys.verifyBearerToken(token);
    }
    const user = await this.auth.verifyAccessToken(token);
    return { ...user, authMethod: "jwt" };
  }
}

function readHeader(request: IncomingMessage, name: string): string | undefined {
  const value = request.headers[name];
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

function readAccessTokenFromRequest(request: IncomingMessage): string | undefined {
  const header = request.headers.authorization;
  const authorization = typeof header === "string" ? header : header?.[0];
  const bearer = extractBearerToken(authorization);
  if (bearer !== undefined) {
    return bearer;
  }

  const url = request.url;
  if (url === undefined) {
    return undefined;
  }
  try {
    const parsed = new URL(url, "http://localhost");
    const token = parsed.searchParams.get("access_token")?.trim();
    return token !== undefined && token.length > 0 ? token : undefined;
  } catch {
    return undefined;
  }
}

function readWorkspaceQuery(request: IncomingMessage): string | undefined {
  const url = request.url;
  if (url === undefined) {
    return undefined;
  }
  try {
    const parsed = new URL(url, "http://localhost");
    const workspaceId = parsed.searchParams.get("workspaceId")?.trim();
    return workspaceId !== undefined && workspaceId.length > 0 ? workspaceId : undefined;
  } catch {
    return undefined;
  }
}
