"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

import { useAuth } from "@/components/providers/auth-provider";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError, formatApiErrorMessage } from "@/lib/api/errors";
import {
  deleteAccountRequest,
  emailStatusRequest,
  resendVerificationRequest,
} from "@/lib/auth/auth-api";
import { withAccessToken } from "@/lib/auth/with-access-token";

/**
 * Account page — identity, verification, and account deletion.
 */
export default function AccountPage() {
  const router = useRouter();
  const { user, logout, getAccessToken } = useAuth();
  const { activeWorkspace } = useWorkspace();
  const [emailVerified, setEmailVerified] = useState<boolean | null>(
    user?.emailVerified ?? null,
  );
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const token = await getAccessToken();
      if (token === null || cancelled) {
        return;
      }
      try {
        const status = await emailStatusRequest(token);
        if (!cancelled) {
          setEmailVerified(status.emailVerified);
        }
      } catch {
        // Keep session-derived value when status endpoint is unavailable.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getAccessToken]);

  async function onResendVerification(): Promise<void> {
    setVerifyMessage(null);
    if (user?.email === null || user?.email === undefined) {
      setVerifyMessage("No email on this account.");
      return;
    }
    try {
      await resendVerificationRequest(user.email, `${window.location.origin}/auth/callback`);
      setVerifyMessage("Verification email sent.");
      const token = await getAccessToken();
      if (token !== null) {
        const status = await emailStatusRequest(token);
        setEmailVerified(status.emailVerified);
      }
    } catch {
      setVerifyMessage("Unable to resend verification email.");
    }
  }

  async function onSignOut(): Promise<void> {
    await logout();
    router.replace("/login");
  }

  async function onDeleteAccount(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setDeleteError(null);
    setDeleting(true);
    try {
      await withAccessToken(getAccessToken, (token) =>
        deleteAccountRequest(token, deleteConfirmation),
      );
      await logout();
      router.replace("/login");
    } catch (cause: unknown) {
      if (cause instanceof ApiError) {
        setDeleteError(formatApiErrorMessage(cause, "Unable to delete account."));
      } else if (cause instanceof Error) {
        setDeleteError(cause.message);
      } else {
        setDeleteError("Unable to delete account.");
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <div>
        <p className="font-mono text-[12px] tracking-[-0.02em] text-pale-stone uppercase">
          Account
        </p>
        <h2 className="mt-1 text-[36px] leading-[1.1] tracking-[-1.12px] text-bone">
          Identity
        </h2>
        <p className="mt-2 text-sm text-warm-granite">Signed-in identity from the Badger API.</p>
      </div>

      <Card className="rounded-[10px] border-ash-stroke bg-carbon-lift shadow-none">
        <CardHeader>
          <CardTitle>Current user</CardTitle>
          <CardDescription>Verified JWT session via GET /api/v1/me.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="font-mono text-[12px] text-pale-stone uppercase">Email</p>
            <p className="text-bone">{user?.email ?? "—"}</p>
          </div>
          <div>
            <p className="font-mono text-[12px] text-pale-stone uppercase">Email verified</p>
            <p className="text-bone">
              {emailVerified === null ? "—" : emailVerified ? "Yes" : "No"}
            </p>
            {emailVerified === false ? (
              <div className="mt-2 space-y-2">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="rounded-[3px]"
                  onClick={() => void onResendVerification()}
                >
                  Resend verification email
                </Button>
                {verifyMessage !== null ? (
                  <p className="text-xs text-warm-granite">{verifyMessage}</p>
                ) : null}
              </div>
            ) : null}
          </div>
          <div>
            <p className="font-mono text-[12px] text-pale-stone uppercase">User id</p>
            <p className="break-all font-mono text-xs text-bone">{user?.id}</p>
          </div>
          <div>
            <p className="font-mono text-[12px] text-pale-stone uppercase">Active workspace</p>
            <p className="text-bone">{activeWorkspace?.name ?? "—"}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            className="rounded-[3px]"
            onClick={() => void onSignOut()}
          >
            Sign out
          </Button>
        </CardContent>
      </Card>

      <Card className="rounded-[10px] border-ash-stroke bg-carbon-lift shadow-none">
        <CardHeader>
          <CardTitle>Delete account</CardTitle>
          <CardDescription>
            Permanently removes your Badger account. Type{" "}
            <span className="font-mono">delete my account</span> to confirm.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-3" onSubmit={(e) => void onDeleteAccount(e)}>
            <Input
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder="delete my account"
              disabled={deleting}
              autoComplete="off"
              className="rounded-[3px]"
            />
            {deleteError !== null ? (
              <p className="text-sm text-signal-orange" role="alert">
                {deleteError}
              </p>
            ) : null}
            <Button
              type="submit"
              variant="destructive"
              className="rounded-[3px]"
              disabled={
                deleting || deleteConfirmation.trim().toLowerCase() !== "delete my account"
              }
            >
              {deleting ? "Deleting…" : "Delete account"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
