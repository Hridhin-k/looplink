/**
 * Authenticated user identity derived from a verified Supabase JWT
 * or a workspace-scoped API key.
 */
export interface AuthUser {
  readonly id: string;
  readonly email: string | null;
  /** Defaults to jwt when omitted (legacy callers). */
  readonly authMethod?: "jwt" | "api_key";
  /** Present when authenticated via workspace API key. */
  readonly workspaceId?: string;
  readonly apiKeyId?: string;
  /** Present for JWT users when Supabase reports confirmation. */
  readonly emailVerified?: boolean;
}

/**
 * Opaque session tokens returned after login or refresh.
 *
 * The Nest server remains stateless — tokens are stored only on the client
 * (Bearer) and optionally mirrored in HttpOnly cookies when enabled.
 */
export interface AuthSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  /** Unix epoch seconds when the access token expires. */
  readonly expiresAt: number;
  readonly user: AuthUser;
}

/**
 * Fastify/Nest request fields populated by auth middleware / guards.
 */
export interface AuthenticatedRequestUser {
  readonly user: AuthUser;
  readonly accessToken: string;
}
