"use client";

import { CheckIcon, CopyIcon } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useState, type ComponentProps } from "react";

import { Button } from "@/components/ui/button";
import { duration, MACHINE_EASE } from "@/lib/motion";
import { cn } from "@/lib/utils";

type ButtonSize = ComponentProps<typeof Button>["size"];
type ButtonVariant = ComponentProps<typeof Button>["variant"];

interface CopyButtonProps {
  readonly value: string;
  readonly label?: string;
  readonly copiedLabel?: string;
  readonly size?: ButtonSize;
  readonly variant?: ButtonVariant;
  readonly className?: string;
  readonly disabled?: boolean;
  readonly onCopied?: () => void;
}

/**
 * Copy control with icon swap + brief success flash.
 */
export function CopyButton({
  value,
  label = "Copy",
  copiedLabel = "Copied",
  size = "sm",
  variant = "outline",
  className,
  disabled = false,
  onCopied,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);
  const reduce = useReducedMotion();

  const onCopy = (): void => {
    void navigator.clipboard.writeText(value).then(() => {
      setCopied(true);
      onCopied?.();
      window.setTimeout(() => setCopied(false), 1_500);
    });
  };

  return (
    <Button
      type="button"
      size={size}
      variant={variant}
      disabled={disabled}
      className={cn(copied && "animate-mc-success-flash text-metric-green", className)}
      onClick={onCopy}
      aria-live="polite"
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={copied ? "copied" : "idle"}
          className="inline-flex items-center gap-1.5"
          initial={reduce ? false : { opacity: 0, y: 2 }}
          animate={{ opacity: 1, y: 0 }}
          exit={reduce ? undefined : { opacity: 0, y: -2 }}
          transition={{ duration: duration.fast, ease: MACHINE_EASE }}
        >
          {copied ? (
            <CheckIcon className={cn("size-3.5", !reduce && "animate-mc-copy-pop")} />
          ) : (
            <CopyIcon className="size-3.5" />
          )}
          {copied ? copiedLabel : label}
        </motion.span>
      </AnimatePresence>
    </Button>
  );
}
