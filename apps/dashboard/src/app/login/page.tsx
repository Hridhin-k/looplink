import { Suspense } from "react";

import { LoginForm } from "@/components/auth/login-form";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Public sign-in page (no dashboard chrome).
 */
export default function LoginPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 bg-obsidian-canvas px-4">
      <div className="space-y-3 text-center">
        <p className="font-mono text-[12px] tracking-[0.18em] text-bone uppercase">Badger</p>
        <h1 className="text-[36px] leading-[1.1] tracking-[-1.12px] text-bone">Sign in</h1>
        <p className="text-sm text-warm-granite">
          Continue with Google, or use email and password.
        </p>
      </div>
      <Suspense fallback={<Skeleton className="h-48 w-full max-w-sm bg-carbon-lift" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
