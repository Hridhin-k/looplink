import { AppShell } from "@/components/layout/app-shell";

/**
 * Authenticated-style chrome for all dashboard routes.
 */
export default function DashboardLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return <AppShell>{children}</AppShell>;
}
