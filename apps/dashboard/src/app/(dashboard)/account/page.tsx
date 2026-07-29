"use client";

import { RequireAuth } from "@/components/auth/require-auth";
import { useAuth } from "@/components/providers/auth-provider";
import { useWorkspace } from "@/components/providers/workspace-provider";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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
  const { user, logout } = useAuth();
  const { activeWorkspace } = useWorkspace();

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
    </div>
  );
}
