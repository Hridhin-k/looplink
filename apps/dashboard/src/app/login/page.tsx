import { Suspense } from "react";

import { LoginForm } from "@/components/auth/login-form";
import { Skeleton } from "@/components/ui/skeleton";

/**
 * Public sign-in page (no dashboard chrome).
 */
export default function LoginPage() {
  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-8 bg-background px-4">
      <div className="space-y-2 text-center">
        <p className="font-heading text-2xl tracking-tight">Badger</p>
        <h1 className="text-lg font-medium">Sign in</h1>
        <p className="text-sm text-muted-foreground">Use your Badger account email and password.</p>
      </div>
      <Suspense fallback={<Skeleton className="h-48 w-full max-w-sm" />}>
        <LoginForm />
      </Suspense>
    </div>
  );
}
