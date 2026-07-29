"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { ApiError } from "@/lib/api/errors";
import {
  loginRequest,
  logoutRequest,
  meRequest,
  refreshRequest,
} from "@/lib/auth/auth-api";
import {
  clearStoredSession,
  readStoredSession,
  writeStoredSession,
} from "@/lib/auth/session-storage";
import type { AuthSession, AuthUser } from "@/lib/auth/types";

/**
 * Auth context value exposed to the dashboard.
 */
export interface AuthContextValue {
  /** True until the first localStorage + optional refresh pass completes. */
  readonly isLoading: boolean;
  /** Current session when signed in. */
  readonly session: AuthSession | null;
  /** Convenience alias for `session?.user`. */
  readonly user: AuthUser | null;
  /** Signs in and persists the session. */
  readonly login: (email: string, password: string) => Promise<void>;
  /** Signs out locally and on the server when possible. */
  readonly logout: () => Promise<void>;
  /** Returns a valid access token, refreshing when near expiry. */
  readonly getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/** Refresh when fewer than 60 seconds remain on the access token. */
const REFRESH_SKEW_SECONDS = 60;

/**
 * Provides auth state with localStorage session persistence.
 *
 * Existing inspector pages remain usable while signed out.
 */
export function AuthProvider({ children }: { readonly children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const persist = useCallback((next: AuthSession | null) => {
    setSession(next);
    if (next === null) {
      clearStoredSession();
    } else {
      writeStoredSession(next);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function hydrate(): Promise<void> {
      const stored = readStoredSession();
      if (stored === null) {
        if (!cancelled) {
          setIsLoading(false);
        }
        return;
      }

      try {
        const now = Math.floor(Date.now() / 1000);
        let current = stored;
        if (stored.expiresAt <= now + REFRESH_SKEW_SECONDS) {
          current = await refreshRequest(stored.refreshToken);
        } else {
          // Confirm the access token still works after a hard refresh.
          await meRequest(stored.accessToken);
        }
        if (!cancelled) {
          persist(current);
        }
      } catch {
        if (!cancelled) {
          persist(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void hydrate();
    return () => {
      cancelled = true;
    };
  }, [persist]);

  const login = useCallback(
    async (email: string, password: string): Promise<void> => {
      const next = await loginRequest(email, password);
      persist(next);
    },
    [persist],
  );

  const logout = useCallback(async (): Promise<void> => {
    const token = session?.accessToken;
    persist(null);
    if (token === undefined) {
      return;
    }
    try {
      await logoutRequest(token);
    } catch (error: unknown) {
      // Local sign-out already succeeded; ignore network/401 on server logout.
      if (!(error instanceof ApiError)) {
        return;
      }
    }
  }, [persist, session?.accessToken]);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    if (session === null) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    if (session.expiresAt > now + REFRESH_SKEW_SECONDS) {
      return session.accessToken;
    }

    try {
      const next = await refreshRequest(session.refreshToken);
      persist(next);
      return next.accessToken;
    } catch {
      persist(null);
      return null;
    }
  }, [persist, session]);

  const value = useMemo<AuthContextValue>(
    () => ({
      isLoading,
      session,
      user: session?.user ?? null,
      login,
      logout,
      getAccessToken,
    }),
    [getAccessToken, isLoading, login, logout, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * Access the auth context. Must be used under {@link AuthProvider}.
 */
export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (value === null) {
    throw new Error("useAuth must be used within AuthProvider.");
  }
  return value;
}
