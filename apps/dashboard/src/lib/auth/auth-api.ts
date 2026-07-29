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
