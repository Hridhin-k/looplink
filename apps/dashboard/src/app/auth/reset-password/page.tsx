"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/errors";
import { resetPasswordRequest } from "@/lib/auth/auth-api";

/**
 * Completes password reset after Supabase redirects with an access_token hash.
 */
export default function ResetPasswordPage() {
  const router = useRouter();
  const [accessToken, setAccessToken] = useState<string | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const hash = window.location.hash.startsWith("#")
      ? window.location.hash.slice(1)
      : window.location.hash;
    const params = new URLSearchParams(hash);
    const fromHash = params.get("access_token");
    setAccessToken(fromHash);
    if (window.location.search.includes("access_token")) {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.hash}`);
    }
  }, []);

  async function onSubmit(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setError(null);
    if (accessToken === null || accessToken.length === 0) {
      setError("Missing recovery token. Open the link from your email again.");
      return;
    }
    if (password.trim().length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setSubmitting(true);
    try {
      await resetPasswordRequest(accessToken, password);
      router.replace("/login");
    } catch (cause: unknown) {
      if (cause instanceof ApiError) {
        setError(`Reset failed (${String(cause.status)}).`);
      } else {
        setError("Unable to update password.");
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
          <h1 className="text-[36px] leading-[1.1] tracking-[-1.12px] text-bone">
            Choose a new password
          </h1>
          <p className="text-sm text-warm-granite">Set a new password for your Badger account.</p>
        </div>

        <form className="flex flex-col gap-4" onSubmit={(e) => void onSubmit(e)}>
          <div className="space-y-1.5">
            <label htmlFor="password" className="font-mono text-[12px] text-pale-stone uppercase">
              New password
            </label>
            <Input
              id="password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={submitting}
              className="rounded-[3px]"
            />
          </div>
          <div className="space-y-1.5">
            <label
              htmlFor="confirm-password"
              className="font-mono text-[12px] text-pale-stone uppercase"
            >
              Confirm password
            </label>
            <Input
              id="confirm-password"
              type="password"
              autoComplete="new-password"
              required
              minLength={8}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
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
            {submitting ? "Saving…" : "Update password"}
          </Button>
        </form>

        <p className="text-center text-sm text-warm-granite">
          <Link href="/login" className="hover:text-bone">
            Back to sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
