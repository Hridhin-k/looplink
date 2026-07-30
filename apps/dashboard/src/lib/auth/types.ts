/**
 * Authenticated user returned by `/api/v1/me` and auth session payloads.
 */
export interface AuthUser {
  readonly id: string;
  readonly email: string | null;
  readonly emailVerified?: boolean;
}

/**
 * Client-persisted auth session (access + refresh tokens).
 */
export interface AuthSession {
  readonly accessToken: string;
  readonly refreshToken: string;
  /** Unix epoch seconds when the access token expires. */
  readonly expiresAt: number;
  readonly user: AuthUser;
}
