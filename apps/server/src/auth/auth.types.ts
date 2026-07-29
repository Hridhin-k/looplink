/**
 * Authenticated user identity derived from a verified Supabase JWT.
 */
export interface AuthUser {
  readonly id: string;
  readonly email: string | null;
}

/**
 * Opaque session tokens returned after login or refresh.
 *
 * The Nest server remains stateless — tokens are stored only on the client.
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
