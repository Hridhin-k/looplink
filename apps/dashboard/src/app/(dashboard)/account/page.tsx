"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent, type ReactNode } from "react";

import { PageHeader } from "@/components/layout/page-header";
import { useAuth } from "@/components/providers/auth-provider";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { ConfirmAction } from "@/components/workspaces/workspace-actions";
import { ApiError, formatApiErrorMessage } from "@/lib/api/errors";
import {
  deleteAccountRequest,
  emailStatusRequest,
  resendVerificationRequest,
} from "@/lib/auth/auth-api";
import { withAccessToken } from "@/lib/auth/with-access-token";
import { cn } from "@/lib/utils";
import { useConnectionStore } from "@/stores/connection-store";

const DELETE_PHRASE = "delete my account";

/**
 * Security Center — identity, verification, session, workspace, and danger zone.
 * Uses existing auth APIs only; does not change authentication behavior.
 */
export default function SecurityCenterPage() {
  const router = useRouter();
  const { user, session, isLoading, logout, getAccessToken } = useAuth();
  const { activeWorkspace, activeRole, memberships } = useWorkspace();
  const liveStatus = useConnectionStore((s) => s.status);
  const lastMessageAt = useConnectionStore((s) => s.lastMessageAt);

  const [emailVerified, setEmailVerified] = useState<boolean | null>(
    user?.emailVerified ?? null,
  );
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyMessage, setVerifyMessage] = useState<string | null>(null);
  const [statusLoading, setStatusLoading] = useState(true);
  const [deleteConfirmation, setDeleteConfirmation] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setStatusLoading(true);
    void (async () => {
      const token = await getAccessToken();
      if (token === null || cancelled) {
        if (!cancelled) {
          setStatusLoading(false);
        }
        return;
      }
      try {
        const status = await emailStatusRequest(token);
        if (!cancelled) {
          setEmailVerified(status.emailVerified);
        }
      } catch {
        // Keep session-derived value when status endpoint is unavailable.
      } finally {
        if (!cancelled) {
          setStatusLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [getAccessToken]);

  async function onResendVerification(): Promise<void> {
    setVerifyMessage(null);
    setVerifyLoading(true);
    if (user?.email === null || user?.email === undefined) {
      setVerifyMessage("No email on this account.");
      setVerifyLoading(false);
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
    } finally {
      setVerifyLoading(false);
    }
  }

  async function onSignOut(): Promise<void> {
    setSigningOut(true);
    try {
      await logout();
      router.replace("/login");
    } finally {
      setSigningOut(false);
    }
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

  if (isLoading || user === null) {
    return <SecurityCenterLoading />;
  }

  const verified = emailVerified === true;
  const unverified = emailVerified === false;
  const sessionExpiresAt =
    session !== null ? new Date(session.expiresAt * 1_000) : null;
  const deleteReady = deleteConfirmation.trim().toLowerCase() === DELETE_PHRASE;

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <PageHeader
        eyebrow="Account"
        title="Security Center"
        description="Identity, verification, and session controls for your Badger account."
      />

      <Section
        id="identity"
        eyebrow="Identity"
        title="Who you are"
        description="Signed-in identity from the Badger API."
      >
        <dl className="grid gap-5 sm:grid-cols-2">
          <Field label="Email" value={user.email ?? "—"} />
          <Field
            label="User id"
            value={<span className="break-all font-mono text-xs">{user.id}</span>}
          />
        </dl>
      </Section>

      <Section
        id="security"
        eyebrow="Security"
        title="Account access"
        description="Sign out of this browser session when you are done."
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="max-w-sm text-sm text-warm-granite">
            Clears the dashboard session stored in this browser. CLI auth is separate.
          </p>
          <ConfirmAction
            label="Sign out"
            confirmLabel={signingOut ? "Signing out…" : "Confirm sign out"}
            pending={signingOut}
            onConfirm={() => {
              void onSignOut();
            }}
          />
        </div>
      </Section>

      <Section
        id="verification"
        eyebrow="Verification"
        title="Email status"
        description="Confirm ownership of the address on this account."
      >
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-sm text-bone">Status</span>
              {statusLoading ? (
                <Skeleton className="h-5 w-20 rounded-[3px]" />
              ) : (
                <Badge
                  variant="outline"
                  className={cn(
                    verified && "border-metric-green/40 text-metric-green",
                    unverified && "border-signal-orange/40 text-signal-orange",
                  )}
                >
                  {emailVerified === null ? "Unknown" : verified ? "Verified" : "Unverified"}
                </Badge>
              )}
            </div>
            <p className="text-sm text-warm-granite">
              {verified
                ? "This email has been verified."
                : unverified
                  ? "Verify your email to unlock full account recovery options."
                  : "Verification status could not be refreshed."}
            </p>
            {verifyMessage !== null ? (
              <p className="text-xs text-warm-granite" role="status">
                {verifyMessage}
              </p>
            ) : null}
          </div>
          {unverified ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={verifyLoading}
              onClick={() => void onResendVerification()}
            >
              {verifyLoading ? "Sending…" : "Resend verification email"}
            </Button>
          ) : null}
        </div>
      </Section>

      <Section
        id="sessions"
        eyebrow="Sessions"
        title="This browser"
        description="Current dashboard session. CLI sessions are managed separately."
      >
        <dl className="grid gap-5 sm:grid-cols-2">
          <Field
            label="Access token"
            value={
              sessionExpiresAt === null ? (
                "—"
              ) : (
                <span className="font-mono text-xs tabular-nums">
                  Expires {sessionExpiresAt.toLocaleString()}
                </span>
              )
            }
          />
          <Field
            label="Live connection"
            value={
              <span className="inline-flex items-center gap-2">
                <span
                  className={cn(
                    "size-1.5 rounded-full",
                    liveStatus === "connected"
                      ? "animate-mc-live bg-signal-orange"
                      : "bg-graphite-mid",
                  )}
                  aria-hidden
                />
                <span className="capitalize">{liveStatus}</span>
              </span>
            }
          />
          <Field
            label="Last live event"
            value={
              lastMessageAt === null
                ? "—"
                : new Date(lastMessageAt).toLocaleString()
            }
          />
          <Field
            label="Session storage"
            value={<span className="font-mono text-xs">localStorage</span>}
          />
        </dl>
      </Section>

      <Section
        id="workspace"
        eyebrow="Workspace"
        title="Active context"
        description="Traffic and collaboration are scoped to the active workspace."
      >
        <div className="flex flex-wrap items-end justify-between gap-4">
          <dl className="grid gap-4 sm:grid-cols-2">
            <Field label="Active workspace" value={activeWorkspace?.name ?? "—"} />
            <Field
              label="Your role"
              value={
                <Badge variant="outline" className="rounded-[3px]">
                  {activeRole ?? "—"}
                </Badge>
              }
            />
            <Field
              label="Memberships"
              value={`${String(memberships.length)} workspace${memberships.length === 1 ? "" : "s"}`}
            />
            <Field
              label="Kind"
              value={
                <Badge variant="outline" className="rounded-[3px]">
                  {activeWorkspace?.kind ?? "—"}
                </Badge>
              }
            />
          </dl>
          <Link
            href="/workspace"
            className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
          >
            Open workspace hub
          </Link>
        </div>
      </Section>

      <section
        id="danger"
        className="overflow-hidden rounded-[10px] border border-signal-orange/40 bg-carbon-lift shadow-panel"
        aria-labelledby="danger-title"
      >
        <div className="border-b border-signal-orange/25 px-5 py-4 sm:px-6">
          <p className="text-caption text-signal-orange">Danger zone</p>
          <h2 id="danger-title" className="mt-1.5 text-lg tracking-tight text-bone">
            Delete account
          </h2>
          <p className="mt-1 text-sm text-warm-granite">
            Permanently removes your Badger account. This cannot be undone. Type{" "}
            <span className="font-mono text-bone">{DELETE_PHRASE}</span> to enable deletion.
          </p>
        </div>
        <form className="space-y-4 px-5 py-5 sm:px-6" onSubmit={(e) => void onDeleteAccount(e)}>
          <div className="space-y-1.5">
            <label className="text-caption text-pale-stone" htmlFor="delete-confirm">
              Confirmation phrase
            </label>
            <Input
              id="delete-confirm"
              value={deleteConfirmation}
              onChange={(e) => setDeleteConfirmation(e.target.value)}
              placeholder={DELETE_PHRASE}
              disabled={deleting}
              autoComplete="off"
              aria-invalid={deleteError !== null}
            />
          </div>
          {deleteError !== null ? (
            <p className="text-sm text-signal-orange" role="alert">
              {deleteError}
            </p>
          ) : null}
          <Button type="submit" variant="destructive" disabled={deleting || !deleteReady}>
            {deleting ? "Deleting…" : "Delete my account"}
          </Button>
        </form>
      </section>
    </div>
  );
}

function Section({
  id,
  eyebrow,
  title,
  description,
  children,
}: {
  readonly id: string;
  readonly eyebrow: string;
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
}) {
  return (
    <section
      id={id}
      className="scroll-mt-28 overflow-hidden rounded-[10px] border border-ash-stroke bg-carbon-lift shadow-panel"
      aria-labelledby={`${id}-title`}
    >
      <div className="border-b border-ash-stroke px-5 py-4 sm:px-6">
        <p className="text-caption text-pale-stone">{eyebrow}</p>
        <h2 id={`${id}-title`} className="mt-1.5 text-lg tracking-tight text-bone">
          {title}
        </h2>
        <p className="mt-1 text-sm text-warm-granite">{description}</p>
      </div>
      <div className="px-5 py-5 sm:px-6">{children}</div>
    </section>
  );
}

function Field({
  label,
  value,
}: {
  readonly label: string;
  readonly value: ReactNode;
}) {
  return (
    <div className="min-w-0">
      <dt className="text-caption text-pale-stone">{label}</dt>
      <dd className="mt-1.5 text-sm text-bone">{value}</dd>
    </div>
  );
}

function SecurityCenterLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-8" aria-busy="true">
      <div className="space-y-3">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-9 w-56 max-w-full" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      {Array.from({ length: 4 }, (_, index) => (
        <div
          key={index}
          className="space-y-4 rounded-[10px] border border-ash-stroke bg-carbon-lift p-5"
        >
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-16 w-full" />
        </div>
      ))}
    </div>
  );
}
