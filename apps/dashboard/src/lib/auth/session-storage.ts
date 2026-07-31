import type { AuthSession } from "./types";

const STORAGE_KEY = "badger.auth.session";

/**
 * Reads the persisted auth session from `localStorage`.
 *
 * @returns Session, or `null` when absent/invalid.
 */
export function readStoredSession(): AuthSession | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null || raw.trim().length === 0) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isAuthSession(parsed)) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Persists an auth session to `localStorage`.
 *
 * @param session - Session to store.
 */
export function writeStoredSession(session: AuthSession): void {
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

/**
 * Clears the persisted auth session.
 */
export function clearStoredSession(): void {
  window.localStorage.removeItem(STORAGE_KEY);
}

function isAuthSession(value: unknown): value is AuthSession {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const record = value as Record<string, unknown>;
  const user = record["user"];
  if (typeof user !== "object" || user === null) {
    return false;
  }
  const userRecord = user as Record<string, unknown>;
  return (
    typeof record["accessToken"] === "string" &&
    typeof record["refreshToken"] === "string" &&
    typeof record["expiresAt"] === "number" &&
    typeof userRecord["id"] === "string" &&
    (userRecord["email"] === null || typeof userRecord["email"] === "string")
  );
}
