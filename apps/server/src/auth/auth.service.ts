import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";

import type { BadgerSupabaseClient } from "../database/create-supabase-clients.js";
import {
  SUPABASE_ANON_CLIENT,
  SUPABASE_CONFIG,
  SUPABASE_SERVICE_ROLE_CLIENT,
} from "../database/database.tokens.js";
import type { SupabaseConfig } from "../database/supabase.config.js";
import type { AuthSession, AuthUser } from "./auth.types.js";

/**
 * Authentication application service backed by Supabase Auth.
 *
 * Domain code depends on this service — not on the Supabase SDK directly.
 */
@Injectable()
export class AuthService {
  /**
   * @param config - Resolved Supabase configuration.
   * @param anon - Anon-key client used for password grant / refresh.
   * @param serviceRole - Service-role client used for privileged sign-out.
   */
  constructor(
    @Inject(SUPABASE_CONFIG) private readonly config: SupabaseConfig,
    @Inject(SUPABASE_ANON_CLIENT) private readonly anon: BadgerSupabaseClient | null,
    @Inject(SUPABASE_SERVICE_ROLE_CLIENT)
    private readonly serviceRole: BadgerSupabaseClient | null,
  ) {}

  /**
   * Signs in with email and password via Supabase Auth.
   *
   * @param email - User email.
   * @param password - User password.
   * @returns Session tokens and user identity.
   */
  async login(email: string, password: string): Promise<AuthSession> {
    const client = this.requireAnonClient();
    const normalizedEmail = normalizeEmail(email);
    if (normalizedEmail.length === 0) {
      throw new BadRequestException("Email is required.");
    }
    if (password.length === 0) {
      throw new BadRequestException("Password is required.");
    }

    const { data, error } = await client.auth.signInWithPassword({
      email: normalizedEmail,
      password,
    });

    if (error !== null) {
      throw new UnauthorizedException(error.message);
    }

    return toAuthSession(data.session, data.user);
  }

  /**
   * Exchanges a refresh token for a new access token.
   *
   * @param refreshToken - Refresh token from a prior session.
   * @returns Renewed session.
   */
  async refresh(refreshToken: string): Promise<AuthSession> {
    const client = this.requireAnonClient();
    if (refreshToken.trim().length === 0) {
      throw new BadRequestException("refreshToken is required.");
    }

    const { data, error } = await client.auth.refreshSession({
      refresh_token: refreshToken.trim(),
    });

    if (error !== null || data.session === null || data.user === null) {
      throw new UnauthorizedException(error?.message ?? "Invalid refresh token.");
    }

    return toAuthSession(data.session, data.user);
  }

  /**
   * Invalidates the caller's refresh tokens (global sign-out).
   *
   * @param accessToken - Bearer access token from the Authorization header.
   */
  async logout(accessToken: string): Promise<void> {
    const admin = this.requireServiceRoleClient();
    const { error } = await admin.auth.admin.signOut(accessToken, "global");
    if (error !== null) {
      throw new UnauthorizedException(error.message);
    }
  }

  /**
   * Verifies a JWT and returns the corresponding user.
   *
   * @param accessToken - Bearer access token.
   * @returns Authenticated user.
   */
  async verifyAccessToken(accessToken: string): Promise<AuthUser> {
    const client = this.requireAnonClient();
    const token = accessToken.trim();
    if (token.length === 0) {
      throw new UnauthorizedException("Missing access token.");
    }

    const { data, error } = await client.auth.getUser(token);
    if (error !== null) {
      throw new UnauthorizedException(error.message);
    }

    return toAuthUser(data.user);
  }

  private requireAnonClient(): BadgerSupabaseClient {
    if (!this.config.enabled || this.anon === null) {
      throw new ServiceUnavailableException(
        "Authentication is unavailable: Supabase is not configured.",
      );
    }
    return this.anon;
  }

  private requireServiceRoleClient(): BadgerSupabaseClient {
    if (!this.config.enabled || this.serviceRole === null) {
      throw new ServiceUnavailableException(
        "Authentication is unavailable: Supabase is not configured.",
      );
    }
    return this.serviceRole;
  }
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toAuthUser(user: { id: string; email?: string | null }): AuthUser {
  return {
    id: user.id,
    email: user.email ?? null,
  };
}

function toAuthSession(
  session: {
    access_token: string;
    refresh_token: string;
    expires_at?: number;
  } | null,
  user: { id: string; email?: string | null } | null,
): AuthSession {
  if (session === null || user === null) {
    throw new UnauthorizedException("Authentication did not return a session.");
  }

  const expiresAt =
    typeof session.expires_at === "number"
      ? session.expires_at
      : Math.floor(Date.now() / 1000) + 3600;

  return {
    accessToken: session.access_token,
    refreshToken: session.refresh_token,
    expiresAt,
    user: toAuthUser(user),
  };
}
