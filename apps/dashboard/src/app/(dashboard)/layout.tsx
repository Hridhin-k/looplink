import { AppShell } from "@/components/layout/app-shell";
import { RequireAuth } from "@/components/auth/require-auth";
import { DashboardSocketProvider } from "@/components/providers/dashboard-socket-provider";

/**
 * All product routes require a session. Public auth pages live outside this group.
 *
 * Live socket connects only after auth succeeds — never on landing/login.
 */
export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <RequireAuth>
      <DashboardSocketProvider>
        <AppShell>{children}</AppShell>
      </DashboardSocketProvider>
    </RequireAuth>
  );
}
