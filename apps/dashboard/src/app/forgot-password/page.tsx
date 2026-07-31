"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/errors";
import { forgotPasswordRequest } from "@/lib/auth/auth-api";

/**
 * Request a password-reset email via the Nest API.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const redirectTo = `${window.location.origin}/auth/reset-password`;
      await forgotPasswordRequest(email, redirectTo);
      setDone(true);
    } catch (cause: unknown) {
      if (cause instanceof ApiError) {
        setError(`Request failed (${String(cause.status)}).`);
      } else {
        setError("Unable to send reset email. Try again.");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-svh items-center justify-center bg-obsidian-canvas px-4">
      <div className="w-full max-w-sm space-y-6">
        <div className="space-y-2">
          <p className="font-mono text-[12px] tracking-[0.18em] text-bone uppercase">Badger</p>
          <h1 className="text-[36px] leading-[1.1] tracking-[-1.12px] text-bone">Reset password</h1>
          <p className="text-sm text-warm-granite">
            We will email a secure link to choose a new password.
          </p>
        </div>

        {done ? (
          <p className="text-sm text-bone" role="status">
            If an account exists for that email, a reset link is on the way.
          </p>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={(e) => void onSubmit(e)}>
            <div className="space-y-1.5">
              <label htmlFor="email" className="font-mono text-[12px] text-pale-stone uppercase">
                Email
              </label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                className="rounded-[3px]"
              />
            </div>
            {error !== null ? (
              <p className="text-sm text-signal-orange" role="alert">
                {error}
              </p>
            ) : null}
            <Button type="submit" disabled={submitting} className="w-full rounded-[3px]">
              {submitting ? "Sending…" : "Send reset link"}
            </Button>
          </form>
        )}

        <p className="text-center text-sm text-warm-granite">
          <Link href="/login" className="hover:text-bone">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
