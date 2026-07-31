import { createHash, randomBytes } from "node:crypto";

import type { FastifyReply, FastifyRequest } from "fastify";

/** HttpOnly access token cookie (optional cookie session mode). */
export const ACCESS_COOKIE = "badger_access";
/** HttpOnly refresh token cookie (scoped to auth refresh/logout). */
export const REFRESH_COOKIE = "badger_refresh";
/** Readable CSRF token for double-submit when using cookie auth. */
export const CSRF_COOKIE = "badger_csrf";
export const CSRF_HEADER = "x-csrf-token";

/**
 * Whether secure auth cookies should be issued (cross-origin dashboard needs this).
 * Requires a non-empty BADGER_ALLOWED_ORIGINS allow-list (never permissive + credentials).
 */
export function isAuthCookieEnabled(): boolean {
  const raw = process.env["BADGER_AUTH_COOKIE_ENABLED"]?.trim().toLowerCase();
  const requested = raw === "1" || raw === "true" || raw === "yes";
  if (!requested) {
    return false;
  }
  const origins = process.env["BADGER_ALLOWED_ORIGINS"]?.trim() ?? "";
  if (origins.length === 0) {
    throw new Error(
      "BADGER_AUTH_COOKIE_ENABLED requires BADGER_ALLOWED_ORIGINS (explicit allow-list). Credentialed CORS must never be permissive.",
    );
  }
  return true;
}

function isProduction(): boolean {
  return process.env["NODE_ENV"] === "production";
}

function cookieDomain(): string | undefined {
  const domain = process.env["BADGER_COOKIE_DOMAIN"]?.trim();
  return domain !== undefined && domain.length > 0 ? domain : undefined;
}

function baseCookieFlags(maxAgeSeconds: number): string {
  const parts = [
    "Path=/",
    `Max-Age=${String(maxAgeSeconds)}`,
    isProduction() || process.env["BADGER_COOKIE_SECURE"] === "1" ? "Secure" : "",
    // Cross-site dashboard (different port/host) requires None when cookies are enabled.
    isAuthCookieEnabled() ? "SameSite=None" : "SameSite=Lax",
  ];
  const domain = cookieDomain();
  if (domain !== undefined) {
    parts.push(`Domain=${domain}`);
  }
  return parts.filter((part) => part.length > 0).join("; ");
}

/**
 * Issues access / refresh / CSRF cookies after login or refresh.
 */
export function setAuthCookies(
  reply: FastifyReply,
  session: { accessToken: string; refreshToken: string; expiresAt: number },
): string {
  const csrf = randomBytes(32).toString("hex");
  const accessMaxAge = Math.max(60, session.expiresAt - Math.floor(Date.now() / 1000));
  const refreshMaxAge = 60 * 60 * 24 * 30;

  void reply.header(
    "set-cookie",
    `${ACCESS_COOKIE}=${encodeURIComponent(session.accessToken)}; HttpOnly; ${baseCookieFlags(accessMaxAge)}`,
  );
  void reply.header(
    "set-cookie",
    `${REFRESH_COOKIE}=${encodeURIComponent(session.refreshToken)}; HttpOnly; ${baseCookieFlags(refreshMaxAge)}`,
  );
  void reply.header(
    "set-cookie",
    `${CSRF_COOKIE}=${csrf}; ${baseCookieFlags(refreshMaxAge)}`,
  );
  return csrf;
}

/**
 * Clears auth cookies on logout / account deletion.
 */
export function clearAuthCookies(reply: FastifyReply): void {
  const expired = "Max-Age=0; Path=/";
  const secure =
    isProduction() || process.env["BADGER_COOKIE_SECURE"] === "1" ? "; Secure" : "";
  const sameSite = isAuthCookieEnabled() ? "; SameSite=None" : "; SameSite=Lax";
  const domain = cookieDomain();
  const domainPart = domain !== undefined ? `; Domain=${domain}` : "";
  for (const name of [ACCESS_COOKIE, REFRESH_COOKIE, CSRF_COOKIE]) {
    void reply.header(
      "set-cookie",
      `${name}=; HttpOnly; ${expired}${secure}${sameSite}${domainPart}`,
    );
  }
}

/**
 * Parses a Cookie header into a map.
 */
export function parseCookies(header: string | undefined): Record<string, string> {
  if (header === undefined || header.trim().length === 0) {
    return {};
  }
  const out: Record<string, string> = {};
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx <= 0) {
      continue;
    }
    const name = part.slice(0, idx).trim();
    const value = part.slice(idx + 1).trim();
    if (name.length === 0) {
      continue;
    }
    try {
      out[name] = decodeURIComponent(value);
    } catch {
      out[name] = value;
    }
  }
  return out;
}

export function readCookie(request: FastifyRequest, name: string): string | undefined {
  const cookies = parseCookies(
    typeof request.headers.cookie === "string" ? request.headers.cookie : undefined,
  );
  const value = cookies[name];
  return value !== undefined && value.length > 0 ? value : undefined;
}

/**
 * Double-submit CSRF check for cookie-authenticated mutating requests.
 * Bearer Authorization bypasses CSRF (CLI / SPA with explicit tokens).
 */
export function assertCsrfIfCookieAuth(request: FastifyRequest): void {
  const authorization = request.headers.authorization;
  if (typeof authorization === "string" && authorization.trim().toLowerCase().startsWith("bearer ")) {
    return;
  }

  const method = request.method.toUpperCase();
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") {
    return;
  }

  if (!isAuthCookieEnabled()) {
    return;
  }

  const access = readCookie(request, ACCESS_COOKIE);
  if (access === undefined) {
    return;
  }

  const csrfCookie = readCookie(request, CSRF_COOKIE);
  const csrfHeaderRaw = request.headers[CSRF_HEADER];
  const csrfHeader = Array.isArray(csrfHeaderRaw) ? csrfHeaderRaw[0] : csrfHeaderRaw;
  if (
    csrfCookie === undefined ||
    typeof csrfHeader !== "string" ||
    csrfHeader.length === 0 ||
    csrfCookie !== csrfHeader
  ) {
    throw new Error("CSRF_TOKEN_MISMATCH");
  }
}

/**
 * Stable hash for refresh-token reuse detection (never store plaintext).
 */
export function hashRefreshToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}
