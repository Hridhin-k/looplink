import {
  BadRequestException,
  Inject,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from "@nestjs/common";

import { toAuditFields } from "../audit/audit-meta.js";
import { AuditService } from "../audit/audit.service.js";
import type { BadgerSupabaseClient } from "../database/create-supabase-clients.js";
import {
  SUPABASE_ANON_CLIENT,
  SUPABASE_CONFIG,
  SUPABASE_SERVICE_ROLE_CLIENT,
} from "../database/database.tokens.js";
import type { SupabaseConfig } from "../database/supabase.config.js";
import {
  MONITORING_HOOKS,
  type MonitoringHooks,
} from "../observability/monitoring.hooks.js";
import { OriginValidator } from "../security/origin-validator.js";
import { hashRefreshToken } from "./auth-cookies.js";
import type { AuthSession, AuthUser } from "./auth.types.js";
import { createPkcePair } from "./oauth-pending.store.js";

/**
 * Authentication application service backed by Supabase Auth.
 *
 * Domain code depends on this service — not on the Supabase SDK directly.
 */
@Injectable()
export class AuthService {
  /** In-process refresh reuse detection (rotated tokens cannot be replayed). */
  private readonly consumedRefreshHashes = new Map<string, number>();

  constructor(
    @Inject(SUPABASE_CONFIG) private readonly config: SupabaseConfig,
    @Inject(SUPABASE_ANON_CLIENT) private readonly anon: BadgerSupabaseClient | null,
    @Inject(SUPABASE_SERVICE_ROLE_CLIENT)
    private readonly serviceRole: BadgerSupabaseClient | null,
    private readonly origins: OriginValidator,
    private readonly audit: AuditService,
    @Inject(MONITORING_HOOKS) private readonly monitoring: MonitoringHooks,
  ) {}

  async login(
    email: string,
    password: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<AuthSession> {
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
      this.monitoring.increment("auth.login.failure");
      await this.audit.record({
        action: "auth.login.failure",
        resourceType: "user",
        metadata: { email: normalizedEmail },
        ...toAuditFields(meta),
      });
      throw new UnauthorizedException(error.message);
    }

    const session = toAuthSession(data.session, data.user);
    this.monitoring.increment("auth.login.success");
    await this.audit.record({
      actorUserId: session.user.id,
      action: "auth.login.success",
      resourceType: "user",
      resourceId: session.user.id,
      ...toAuditFields(meta),
    });
    return session;
  }

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

  async completeOAuthLogin(
    input: {
      readonly code: string;
      readonly codeVerifier: string;
    },
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<AuthSession> {
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
          user?: { id?: string; email?: string | null; email_confirmed_at?: string | null };
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

    const session: AuthSession = {
      accessToken: payload.access_token,
      refreshToken: payload.refresh_token,
      expiresAt,
      user: {
        id: payload.user.id,
        email: payload.user.email ?? null,
        authMethod: "jwt",
        emailVerified: Boolean(payload.user.email_confirmed_at),
      },
    };

    await this.audit.record({
      actorUserId: session.user.id,
      action: "auth.oauth.success",
      resourceType: "user",
      resourceId: session.user.id,
      ...toAuditFields(meta),
    });
    return session;
  }

  /**
   * Exchanges a refresh token for a new access token (Supabase rotates refresh tokens).
   * Replaying a previously consumed refresh token fails closed.
   */
  async refresh(
    refreshToken: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<AuthSession> {
    const client = this.requireAnonClient();
    const trimmed = refreshToken.trim();
    if (trimmed.length === 0) {
      throw new BadRequestException("refreshToken is required.");
    }

    const tokenHash = hashRefreshToken(trimmed);
    this.pruneConsumedRefreshHashes();
    if (this.consumedRefreshHashes.has(tokenHash)) {
      this.monitoring.increment("auth.refresh.reuse");
      await this.audit.record({
        action: "auth.refresh.reuse_detected",
        resourceType: "session",
        ...toAuditFields(meta),
      });
      throw new UnauthorizedException("Refresh token has already been used.");
    }

    const { data, error } = await client.auth.refreshSession({
      refresh_token: trimmed,
    });

    if (error !== null || data.session === null || data.user === null) {
      throw new UnauthorizedException(error?.message ?? "Invalid refresh token.");
    }

    this.consumedRefreshHashes.set(tokenHash, Date.now());
    const session = toAuthSession(data.session, data.user);
    await this.audit.record({
      actorUserId: session.user.id,
      action: "auth.refresh.success",
      resourceType: "session",
      resourceId: session.user.id,
      ...toAuditFields(meta),
    });
    return session;
  }

  async logout(
    accessToken: string,
    meta?: { actorUserId?: string; ipAddress?: string; userAgent?: string },
  ): Promise<void> {
    const admin = this.requireServiceRoleClient();
    const { error } = await admin.auth.admin.signOut(accessToken, "global");
    if (error !== null) {
      throw new UnauthorizedException(error.message);
    }
    await this.audit.record({
      action: "auth.logout",
      resourceType: "session",
      ...(meta?.actorUserId !== undefined ? { actorUserId: meta.actorUserId } : {}),
      ...toAuditFields(meta),
    });
  }

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

  /**
   * Sends a password-reset email via Supabase Auth.
   */
  async requestPasswordReset(
    email: string,
    redirectTo: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<void> {
    const client = this.requireAnonClient();
    const normalizedEmail = normalizeEmail(email);
    if (normalizedEmail.length === 0) {
      throw new BadRequestException("Email is required.");
    }
    const safeRedirect = validatePasswordRedirectTo(redirectTo, this.origins);

    const { error } = await client.auth.resetPasswordForEmail(normalizedEmail, {
      redirectTo: safeRedirect,
    });
    if (error !== null) {
      throw new BadRequestException(error.message);
    }

    await this.audit.record({
      action: "auth.password_reset.requested",
      resourceType: "user",
      metadata: { email: normalizedEmail },
      ...toAuditFields(meta),
    });
  }

  /**
   * Sets a new password using the recovery access token from the email link.
   */
  async updatePassword(
    accessToken: string,
    newPassword: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<void> {
    if (newPassword.trim().length < 8) {
      throw new BadRequestException("Password must be at least 8 characters.");
    }

    const config = this.requireEnabledConfig();
    const response = await fetch(`${config.url}/auth/v1/user`, {
      method: "PUT",
      headers: {
        apikey: config.anonKey,
        Authorization: `Bearer ${accessToken.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ password: newPassword }),
    });

    if (!response.ok) {
      const detail = await response.text();
      throw new BadRequestException(
        detail.length > 0 ? detail : "Unable to update password.",
      );
    }

    const user = await this.verifyAccessToken(accessToken);
    await this.audit.record({
      actorUserId: user.id,
      action: "auth.password_reset.completed",
      resourceType: "user",
      resourceId: user.id,
      ...toAuditFields(meta),
    });
  }

  async resendVerificationEmail(
    email: string,
    redirectTo: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<void> {
    const client = this.requireAnonClient();
    const normalizedEmail = normalizeEmail(email);
    if (normalizedEmail.length === 0) {
      throw new BadRequestException("Email is required.");
    }
    const safeRedirect = validateOAuthRedirectTo(redirectTo, this.origins);

    const { error } = await client.auth.resend({
      type: "signup",
      email: normalizedEmail,
      options: { emailRedirectTo: safeRedirect },
    });
    if (error !== null) {
      throw new BadRequestException(error.message);
    }

    await this.audit.record({
      action: "auth.email_verification.resent",
      resourceType: "user",
      metadata: { email: normalizedEmail },
      ...toAuditFields(meta),
    });
  }

  async getEmailStatus(accessToken: string): Promise<{
    email: string | null;
    emailVerified: boolean;
  }> {
    const user = await this.verifyAccessToken(accessToken);
    return {
      email: user.email,
      emailVerified: user.emailVerified ?? false,
    };
  }

  /**
   * Permanently deletes the authenticated user via the service-role admin API.
   */
  async deleteAccount(
    accessToken: string,
    confirmation: string,
    meta?: { ipAddress?: string; userAgent?: string },
  ): Promise<void> {
    if (confirmation.trim().toLowerCase() !== "delete my account") {
      throw new BadRequestException('Type "delete my account" to confirm.');
    }

    const user = await this.verifyAccessToken(accessToken);
    const admin = this.requireServiceRoleClient();
    const { error } = await admin.auth.admin.deleteUser(user.id);
    if (error !== null) {
      this.monitoring.captureException(error, { action: "auth.account.delete" });
      throw new BadRequestException(error.message);
    }

    await this.audit.record({
      actorUserId: user.id,
      action: "auth.account.deleted",
      resourceType: "user",
      resourceId: user.id,
      ...toAuditFields(meta),
    });
    this.monitoring.increment("auth.account.deleted");
  }

  private pruneConsumedRefreshHashes(): void {
    const cutoff = Date.now() - 60 * 60 * 1000;
    for (const [hash, at] of this.consumedRefreshHashes) {
      if (at < cutoff) {
        this.consumedRefreshHashes.delete(hash);
      }
    }
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

function validatePasswordRedirectTo(raw: string, origins: OriginValidator): string {
  let url: URL;
  try {
    url = new URL(raw.trim());
  } catch {
    throw new BadRequestException("redirectTo must be an absolute URL.");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new BadRequestException("redirectTo must be http(s).");
  }
  if (url.pathname !== "/auth/reset-password") {
    throw new BadRequestException('redirectTo path must be "/auth/reset-password".');
  }
  if (!origins.isOriginAllowed(url.origin)) {
    throw new BadRequestException("redirectTo origin is not allowed.");
  }

  return `${url.origin}/auth/reset-password`;
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

function toAuthUser(user: {
  id: string;
  email?: string | null;
  email_confirmed_at?: string | null;
}): AuthUser {
  return {
    id: user.id,
    email: user.email ?? null,
    authMethod: "jwt",
    emailVerified: Boolean(user.email_confirmed_at),
  };
}

function toAuthSession(
  session: {
    access_token: string;
    refresh_token: string;
    expires_at?: number;
  } | null,
  user: {
    id: string;
    email?: string | null;
    email_confirmed_at?: string | null;
  } | null,
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
