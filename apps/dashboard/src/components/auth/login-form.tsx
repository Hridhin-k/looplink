"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/errors";

/**
 * Email/password sign-in form backed by `POST /api/v1/auth/login`.
 */
export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { login } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

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
    <form className="flex w-full max-w-sm flex-col gap-4" onSubmit={(e) => void onSubmit(e)}>
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
          disabled={submitting}
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
          disabled={submitting}
        />
      </div>

      {error !== null ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : null}

      <Button type="submit" disabled={submitting} className="w-full">
        {submitting ? "Signing in…" : "Sign in"}
      </Button>

      <p className="text-center text-sm text-muted-foreground">
        <Link href="/" className="underline-offset-4 hover:underline">
          Back to dashboard
        </Link>
      </p>
    </form>
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
