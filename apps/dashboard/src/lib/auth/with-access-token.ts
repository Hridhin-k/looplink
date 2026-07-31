import { ApiError } from "@/lib/api/errors";

export type AccessTokenGetter = (options?: {
  readonly forceRefresh?: boolean;
}) => Promise<string | null>;

/**
 * Runs an authenticated API call, refreshing once on HTTP 401.
 *
 * Covers the case where local `expiresAt` still looks valid but Supabase has
 * revoked the session (e.g. global logout from another tab).
 */
export async function withAccessToken<T>(
  getAccessToken: AccessTokenGetter,
  run: (accessToken: string) => Promise<T>,
): Promise<T> {
  const token = await getAccessToken();
  if (token === null) {
    throw new Error("Not authenticated");
  }

  try {
    return await run(token);
  } catch (cause: unknown) {
    if (!(cause instanceof ApiError) || cause.status !== 401) {
      throw cause;
    }

    const refreshed = await getAccessToken({ forceRefresh: true });
    if (refreshed === null) {
      throw cause;
    }

    return run(refreshed);
  }
}
