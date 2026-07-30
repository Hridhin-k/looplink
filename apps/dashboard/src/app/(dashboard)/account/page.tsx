"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";

import { RequireAuth } from "@/components/auth/require-auth";
import { useAuth } from "@/components/providers/auth-provider";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { ApiError } from "@/lib/api/errors";
import {
  deleteAccountRequest,
  emailStatusRequest,
  resendVerificationRequest,
} from "@/lib/auth/auth-api";

/**
 * Protected account page showing the current user from `/api/v1/me` session.
 */
export default function AccountPage() {
  return (
    <RequireAuth>
      <AccountContent />
    </RequireAuth>
  );
}

function AccountContent() {
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

  async function refreshEmailStatus(): Promise<void> {
    const token = await getAccessToken();
    if (token === null) {
      return;
    }
    const status = await emailStatusRequest(token);
    setEmailVerified(status.emailVerified);
  }

  async function onResendVerification(): Promise<void> {
    setVerifyMessage(null);
    if (user?.email === null || user?.email === undefined) {
      setVerifyMessage("No email on this account.");
      return;
    }
    try {
      await resendVerificationRequest(user.email, `${window.location.origin}/auth/callback`);
      setVerifyMessage("Verification email sent.");
      await refreshEmailStatus();
    } catch {
      setVerifyMessage("Unable to resend verification email.");
    }
  }

  async function onDeleteAccount(event: FormEvent<HTMLFormElement>): Promise<void> {
    event.preventDefault();
    setDeleteError(null);
    setDeleting(true);
    try {
      const token = await getAccessToken();
      if (token === null) {
        throw new Error("Not authenticated");
      }
      await deleteAccountRequest(token, deleteConfirmation);
      await logout();
      router.replace("/login");
    } catch (cause: unknown) {
      if (cause instanceof ApiError) {
        setDeleteError(`Delete failed (${String(cause.status)}).`);
      } else {
        setDeleteError("Unable to delete account.");
      }
    } finally {
      setDeleting(false);
    }
  }

  return (
    <div className="mx-auto max-w-lg space-y-4">
      <div>
        <h2 className="font-heading text-xl tracking-tight">Account</h2>
        <p className="text-sm text-muted-foreground">Signed-in identity from the Badger API.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Current user</CardTitle>
          <CardDescription>Loaded from the verified JWT via GET /api/v1/me.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3 text-sm">
          <div>
            <p className="text-muted-foreground">Email</p>
            <p className="font-medium">{user?.email ?? "—"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Email verified</p>
            <p className="font-medium">
              {emailVerified === null ? "—" : emailVerified ? "Yes" : "No"}
            </p>
            {emailVerified === false ? (
              <div className="mt-2 space-y-2">
                <Button type="button" size="sm" variant="outline" onClick={() => void onResendVerification()}>
                  Resend verification email
                </Button>
                {verifyMessage !== null ? (
                  <p className="text-xs text-muted-foreground">{verifyMessage}</p>
                ) : null}
              </div>
            ) : null}
          </div>
          <div>
            <p className="text-muted-foreground">User id</p>
            <p className="break-all font-mono text-xs">{user?.id}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Active workspace</p>
            <p className="font-medium">{activeWorkspace?.name ?? "—"}</p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              void logout();
            }}
          >
            Sign out
          </Button>
        </CardContent>
      </Card>

      <Card>
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
            />
            {deleteError !== null ? (
              <p className="text-sm text-destructive" role="alert">
                {deleteError}
              </p>
            ) : null}
            <Button type="submit" variant="destructive" disabled={deleting}>
              {deleting ? "Deleting…" : "Delete account"}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
