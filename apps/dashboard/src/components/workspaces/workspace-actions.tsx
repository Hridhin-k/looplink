"use client";

import { useState, type ReactNode } from "react";

import { CopyButton } from "@/components/motion/copy-button";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SecretRevealProps {
  readonly label: string;
  readonly value: string;
  readonly hint?: ReactNode;
  readonly className?: string;
}

/**
 * One-time secret / invite token panel with copy feedback.
 */
export function SecretReveal({ label, value, hint, className }: SecretRevealProps) {
  const [flash, setFlash] = useState(false);

  return (
    <div
      className={cn(
        "space-y-3 rounded-[10px] border border-signal-orange/35 bg-obsidian-canvas p-4 shadow-panel transition-machine",
        flash && "animate-mc-success-flash",
        className,
      )}
      role="status"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-caption text-signal-orange">{label}</p>
          {hint !== undefined ? (
            <p className="mt-1 text-xs text-warm-granite">{hint}</p>
          ) : (
            <p className="mt-1 text-xs text-warm-granite">Shown once — copy it now.</p>
          )}
        </div>
        <CopyButton
          value={value}
          size="sm"
          variant="outline"
          onCopied={() => {
            setFlash(true);
            window.setTimeout(() => setFlash(false), 700);
          }}
        />
      </div>
      <p className="break-all rounded-[3px] border border-ash-stroke bg-carbon-lift px-3 py-2.5 font-mono text-xs text-bone">
        {value}
      </p>
    </div>
  );
}

interface ConfirmActionProps {
  readonly label: string;
  readonly confirmLabel: string;
  readonly pendingLabel?: string;
  readonly variant?: "outline" | "destructive";
  readonly size?: "sm" | "xs" | "default";
  readonly disabled?: boolean;
  readonly pending?: boolean;
  readonly onConfirm: () => void;
  readonly className?: string;
}

/**
 * Two-step confirmation control — first click arms, second confirms.
 */
export function ConfirmAction({
  label,
  confirmLabel,
  pendingLabel = "Working…",
  variant = "outline",
  size = "sm",
  disabled = false,
  pending = false,
  onConfirm,
  className,
}: ConfirmActionProps) {
  const [armed, setArmed] = useState(false);

  if (armed) {
    return (
      <div className={cn("flex items-center gap-2 animate-page-enter", className)}>
        <Button
          type="button"
          size={size}
          variant="destructive"
          disabled={disabled || pending}
          onClick={() => {
            onConfirm();
            setArmed(false);
          }}
        >
          {pending ? pendingLabel : confirmLabel}
        </Button>
        <Button
          type="button"
          size={size}
          variant="ghost"
          disabled={pending}
          onClick={() => setArmed(false)}
        >
          Cancel
        </Button>
      </div>
    );
  }

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      disabled={disabled || pending}
      className={className}
      onClick={() => setArmed(true)}
    >
      {label}
    </Button>
  );
}
