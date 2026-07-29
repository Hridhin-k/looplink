"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/errors";

/**
 * Sign-in form: Google OAuth + optional email/password.
 */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login, loginWithGoogle } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [googleSubmitting, setGoogleSubmitting] = useState(false);

  async function onGoogle(): Promise<void> {
    setError(null);
    setGoogleSubmitting(true);
    try {
      const next = searchParams.get("next");
      if (isSafeNext(next)) {
        window.sessionStorage.setItem("badger.auth.next", next);
      } else {
        window.sessionStorage.removeItem("badger.auth.next");
      }
      await loginWithGoogle();
    } catch (cause: unknown) {
      setGoogleSubmitting(false);
      if (cause instanceof ApiError) {
        setError(formatApiError(cause));
      } else {
        setError("Google sign-in failed. Check your connection and try again.");
      }
    }
  }

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      await login(email, password);
      const next = searchParams.get("next");
      router.replace(isSafeNext(next) ? next : "/account");
    } catch (cause: unknown) {
      if (cause instanceof ApiError) {
        setError(formatApiError(cause));
      } else {
        setError("Sign-in failed. Check your connection and try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <Button
        type="button"
        variant="outline"
        className="w-full"
        disabled={submitting || googleSubmitting}
        onClick={() => {
          void onGoogle();
        }}
      >
        {googleSubmitting ? "Redirecting…" : "Continue with Google"}
      </Button>

      <div className="relative py-1 text-center text-xs text-muted-foreground">
        <span className="bg-background px-2">or email</span>
        <div className="absolute inset-x-0 top-1/2 -z-10 border-t border-border" />
      </div>

      <form className="flex flex-col gap-4" onSubmit={(e) => void onSubmit(e)}>
        <div className="space-y-1.5">
          <label htmlFor="email" className="text-sm font-medium text-foreground">
            Email
          </label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting || googleSubmitting}
          />
        </div>

        <div className="space-y-1.5">
          <label htmlFor="password" className="text-sm font-medium text-foreground">
            Password
          </label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting || googleSubmitting}
          />
        </div>

        {error !== null ? (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        ) : null}

        <Button type="submit" disabled={submitting || googleSubmitting} className="w-full">
          {submitting ? "Signing in…" : "Sign in with email"}
        </Button>
      </form>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/" className="underline-offset-4 hover:underline">
          Back to dashboard
        </Link>
      </p>
    </div>
  );
}

function isSafeNext(value: string | null): value is string {
  return value !== null && value.startsWith("/") && !value.startsWith("//");
}

function formatApiError(error: ApiError): string {
  if (typeof error.body === "object" && error.body !== null && "message" in error.body) {
    const message = (error.body as { message?: unknown }).message;
    if (typeof message === "string") {
      return message;
    }
    if (Array.isArray(message)) {
      return message.map(String).join(", ");
    }
  }
  if (error.status === 401) {
    return "Invalid email or password.";
  }
  if (error.status === 503) {
    return "Authentication is unavailable. Supabase is not configured on the server.";
  }
  return `Sign-in failed (${String(error.status)}).`;
}
