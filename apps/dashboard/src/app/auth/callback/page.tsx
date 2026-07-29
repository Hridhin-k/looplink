"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError } from "@/lib/api/errors";

/**
 * OAuth redirect target. Exchanges `code` via the Nest API (PKCE verifier in sessionStorage).
 */
export default function AuthCallbackPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background px-4">
      <p className="font-heading text-2xl tracking-tight">Badger</p>
      <Suspense fallback={<Skeleton className="h-8 w-48" />}>
        <AuthCallbackContent />
      </Suspense>
    </div>
  );
}

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { completeOAuth } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run(): Promise<void> {
      const oauthError =
        searchParams.get("error_description") ?? searchParams.get("error");
      if (oauthError !== null && oauthError.trim().length > 0) {
        if (!cancelled) {
          setError(oauthError.replaceAll("+", " "));
        }
        return;
      }

      const code = searchParams.get("code");
      if (code === null || code.trim().length === 0) {
        if (!cancelled) {
          setError("OAuth callback missing code.");
        }
        return;
      }

      try {
        await completeOAuth(code);
        if (cancelled) {
          return;
        }
        const next = window.sessionStorage.getItem("badger.auth.next");
        window.sessionStorage.removeItem("badger.auth.next");
        router.replace(isSafeNext(next) ? next : "/account");
      } catch (cause: unknown) {
        if (cancelled) {
          return;
        }
        if (cause instanceof ApiError) {
          const body = cause.body;
          if (typeof body === "object" && body !== null && "message" in body) {
            const message = (body as { message?: unknown }).message;
            setError(typeof message === "string" ? message : `Sign-in failed (${String(cause.status)}).`);
          } else {
            setError(`Sign-in failed (${String(cause.status)}).`);
          }
        } else if (cause instanceof Error) {
          setError(cause.message);
        } else {
          setError("Sign-in failed. Try again from the login page.");
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [completeOAuth, router, searchParams]);

  if (error !== null) {
    return (
      <div className="max-w-sm space-y-3 text-center">
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
        <a href="/login" className="text-sm underline-offset-4 hover:underline">
          Back to sign in
        </a>
      </div>
    );
  }

  return <p className="text-sm text-muted-foreground">Completing Google sign-in…</p>;
}

function isSafeNext(value: string | null): value is string {
  return value !== null && value.startsWith("/") && !value.startsWith("//");
}
