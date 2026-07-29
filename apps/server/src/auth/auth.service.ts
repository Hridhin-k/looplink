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
import { OriginValidator } from "../security/origin-validator.js";
import type { AuthSession, AuthUser } from "./auth.types.js";
import { createPkcePair } from "./oauth-pending.store.js";

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
   * @param origins - Browser origin allow-list used to validate OAuth redirects.
   */
  constructor(
    @Inject(SUPABASE_CONFIG) private readonly config: SupabaseConfig,
    @Inject(SUPABASE_ANON_CLIENT) private readonly anon: BadgerSupabaseClient | null,
    @Inject(SUPABASE_SERVICE_ROLE_CLIENT)
    private readonly serviceRole: BadgerSupabaseClient | null,
    private readonly origins: OriginValidator,
  ) {}

  /**
   * Signs in with email and password via Supabase Auth.
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
   * Starts a browser OAuth login (PKCE).
   * Returns the authorize URL and code verifier (store verifier in the browser).
   */
  beginOAuthLogin(input: {
    readonly provider: string;
    readonly redirectTo: string;
  }): { readonly url: string; readonly codeVerifier: string } {
    const config = this.requireEnabledConfig();
    const provider = input.provider.trim().toLowerCase();
    if (provider.length === 0) {
      throw new BadRequestException("provider is required.");
    }

    const redirectTo = validateOAuthRedirectTo(input.redirectTo, this.origins);
    const { codeVerifier, codeChallenge } = createPkcePair();

    const authorize = new URL(`${config.url}/auth/v1/authorize`);
    authorize.searchParams.set("provider", provider);
    authorize.searchParams.set("redirect_to", redirectTo);
    authorize.searchParams.set("code_challenge", codeChallenge);
    authorize.searchParams.set("code_challenge_method", "s256");

    return { url: authorize.toString(), codeVerifier };
  }

  /**
   * Completes browser OAuth by exchanging the auth code + PKCE verifier.
   */
  async completeOAuthLogin(input: {
    readonly code: string;
    readonly codeVerifier: string;
  }): Promise<AuthSession> {
    const config = this.requireEnabledConfig();
    const code = input.code.trim();
    const codeVerifier = input.codeVerifier.trim();
    if (code.length === 0) {
      throw new BadRequestException("code is required.");
    }
    if (codeVerifier.length === 0) {
      throw new BadRequestException("codeVerifier is required.");
    }

    const response = await fetch(`${config.url}/auth/v1/token?grant_type=pkce`, {
      method: "POST",
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${config.anonKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        auth_code: code,
        code_verifier: codeVerifier,
      }),
    });

    const payload = (await response.json().catch(() => undefined)) as
      | {
          access_token?: string;
          refresh_token?: string;
          expires_at?: number;
          expires_in?: number;
          user?: { id?: string; email?: string | null };
          error?: string;
          error_description?: string;
          msg?: string;
        }
      | undefined;

    if (!response.ok) {
      const message =
        payload?.error_description ??
        payload?.msg ??
        payload?.error ??
        `OAuth exchange failed (${String(response.status)}).`;
      throw new UnauthorizedException(message);
    }

    if (
      payload === undefined ||
      typeof payload.access_token !== "string" ||
      typeof payload.refresh_token !== "string" ||
      payload.user === undefined ||
      typeof payload.user.id !== "string"
    ) {
      throw new UnauthorizedException("OAuth exchange did not return a session.");
    }

    const expiresAt =
      typeof payload.expires_at === "number"
        ? payload.expires_at
        : Math.floor(Date.now() / 1000) +
          (typeof payload.expires_in === "number" ? payload.expires_in : 3600);

    return {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresAt,
      user: {
        id: payload.user.id,
        email: payload.user.email ?? null,
        authMethod: "jwt",
      },
    };
  }

  /**
   * Exchanges a refresh token for a new access token.
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

  private requireEnabledConfig(): Extract<SupabaseConfig, { enabled: true }> {
    if (!this.config.enabled) {
      throw new ServiceUnavailableException(
        "Authentication is unavailable: Supabase is not configured.",
      );
    }
    return this.config;
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

function validateOAuthRedirectTo(raw: string, origins: OriginValidator): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new BadRequestException("redirectTo must be an absolute URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BadRequestException("redirectTo must be http(s).");
  }
  if (url.pathname !== "/auth/callback") {
    throw new BadRequestException('redirectTo path must be "/auth/callback".');
  }
  if (!origins.isOriginAllowed(url.origin)) {
    throw new BadRequestException("redirectTo origin is not allowed.");
  }

  return `${url.origin}/auth/callback`;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toAuthUser(user: { id: string; email?: string | null }): AuthUser {
  return {
    id: user.id,
    email: user.email ?? null,
    authMethod: "jwt",
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
