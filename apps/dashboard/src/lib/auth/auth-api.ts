import { apiClient } from "@/lib/api/client";

import type { AuthSession, AuthUser } from "./types";

/**
 * Signs in via the Nest auth API (never talks to Supabase from the browser).
 *
 * @param email - User email.
 * @param password - User password.
 * @returns Session tokens and user.
 */
export async function loginRequest(email: string, password: string): Promise<AuthSession> {
  return apiClient<AuthSession>("/api/v1/auth/login", {
    method: "POST",
    json: { email, password },
  });
}

/**
 * Starts Google (or configured) OAuth; returns the authorize URL to navigate to.
 * Stores the PKCE verifier in sessionStorage for the callback exchange.
 */
export async function startOAuthRequest(redirectTo: string, provider = "google"): Promise<string> {
  const result = await apiClient<{ url: string; codeVerifier: string }>("/api/v1/auth/oauth/start", {
    method: "POST",
    json: { redirectTo, provider },
  });
  window.sessionStorage.setItem("badger.auth.pkce", result.codeVerifier);
  return result.url;
}

/**
 * Completes OAuth after `/auth/callback` receives `code`.
 */
export async function completeOAuthRequest(code: string): Promise<AuthSession> {
  const codeVerifier = window.sessionStorage.getItem("badger.auth.pkce");
  window.sessionStorage.removeItem("badger.auth.pkce");
  if (codeVerifier === null || codeVerifier.trim().length === 0) {
    throw new Error("Missing OAuth PKCE verifier. Start sign-in again from the login page.");
  }
  return apiClient<AuthSession>("/api/v1/auth/oauth/callback", {
    method: "POST",
    json: { code, codeVerifier },
  });
}

/**
 * Renews an access token using a refresh token.
 *
 * @param refreshToken - Refresh token from a prior session.
 * @returns Renewed session.
 */
export async function refreshRequest(refreshToken: string): Promise<AuthSession> {
  return apiClient<AuthSession>("/api/v1/auth/refresh", {
    method: "POST",
    json: { refreshToken },
  });
}

/**
 * Signs out on the server (invalidates refresh tokens).
 *
 * @param accessToken - Current access token.
 */
export async function logoutRequest(accessToken: string): Promise<void> {
  await apiClient<void>("/api/v1/auth/logout", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

/**
 * Fetches the current user using a Bearer access token.
 *
 * @param accessToken - Current access token.
 * @returns Authenticated user.
 */
export async function meRequest(accessToken: string): Promise<AuthUser> {
  return apiClient<AuthUser>("/api/v1/me", {
    method: "GET",
    headers: { Authorization: `Bearer ${accessToken}` },
  });
}

/**
 * Requests a password-reset email (always returns success to the UI).
 */
export async function forgotPasswordRequest(email: string, redirectTo: string): Promise<void> {
  await apiClient<void>("/api/v1/auth/password/forgot", {
    method: "POST",
    json: { email, redirectTo },
  });
}

/**
 * Completes password reset with the recovery access token from the email link.
 */
export async function resetPasswordRequest(accessToken: string, password: string): Promise<void> {
  await apiClient<void>("/api/v1/auth/password/reset", {
    method: "POST",
    json: { accessToken, password },
  });
}

/**
 * Resends signup email verification.
 */
export async function resendVerificationRequest(email: string, redirectTo: string): Promise<void> {
  await apiClient<void>("/api/v1/auth/email/resend-verification", {
    method: "POST",
    json: { email, redirectTo },
  });
}

/**
 * Email verification status for the signed-in user.
 */
export async function emailStatusRequest(
  accessToken: string,
): Promise<{ email: string | null; emailVerified: boolean }> {
  return apiClient<{ email: string | null; emailVerified: boolean }>(
    "/api/v1/auth/email/status",
    {
      method: "GET",
      headers: { Authorization: `Bearer ${accessToken}` },
    },
  );
}

/**
 * Permanently deletes the signed-in account.
 */
export async function deleteAccountRequest(
  accessToken: string,
  confirmation: string,
): Promise<void> {
  await apiClient<void>("/api/v1/auth/account", {
    method: "DELETE",
    headers: { Authorization: `Bearer ${accessToken}` },
    json: { confirmation },
  });
}
