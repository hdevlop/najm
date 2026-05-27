'use client';

import {
  SignedIn,
  SignedOut,
  AuthLoading,
  Role,
  Can,
  RedirectToLogin,
} from 'najm-auth/client/react';
import { useAdminUsersQuery } from '@/hooks/useAdminUsersQuery';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { Skeleton } from '@/components/ui/skeleton';

export function AdminPanel() {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Admin Panel</CardTitle>
      </CardHeader>
      <CardContent>
        <AuthLoading>
          <div className="space-y-4">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        </AuthLoading>

        <SignedOut>
          <RedirectToLogin to="/login" preserveFrom />
        </SignedOut>

        <SignedIn>
          <Role
            is="admin"
            fallback={
              <div className="space-y-2 text-center">
                <p className="text-sm text-muted-foreground">
                  You need the <Badge variant="secondary">admin</Badge> role to access this page.
                </p>
              </div>
            }
          >
            <AdminContent />
          </Role>
        </SignedIn>
      </CardContent>
    </Card>
  );
}

function AdminContent() {
  const usersQuery = useAdminUsersQuery();

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h3 className="text-lg font-semibold">Permission Gates</h3>
        <p className="text-xs text-muted-foreground">
          Buttons below render only if you have the matching permission.
        </p>
      </div>

      <div className="grid gap-2">
        <Can permission="create:products">
          <GateAction label="create:products" action="Create Product" />
        </Can>

        <Can permission="read:products">
          <GateAction label="read:products" action="View Products" />
        </Can>

        <Can permission="update:products">
          <GateAction label="update:products" action="Edit Product" />
        </Can>

        <Can permission="delete:products">
          <GateAction label="delete:products" action="Delete Product" variant="destructive" />
        </Can>
      </div>

      <Separator />

      <div className="space-y-2">
        <h3 className="text-lg font-semibold">Direct Client Access</h3>
        <p className="text-xs text-muted-foreground">
          Uses the shared users service with React Query against <code className="text-xs">GET /tools/users</code>.
        </p>
        <Button variant="outline" onClick={() => void usersQuery.refetch()} disabled={usersQuery.isFetching}>
          {usersQuery.isFetching ? 'Refreshing users...' : 'Refresh users'}
        </Button>
        {usersQuery.isPending ? (
          <div className="space-y-2 pt-2">
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : usersQuery.error ? (
          <p className="text-sm text-red-600">Unable to load admin users.</p>
        ) : (
          <div className="space-y-2 pt-2">
            <p className="text-sm text-muted-foreground">
              Loaded {usersQuery.data.length} user{usersQuery.data.length === 1 ? '' : 's'}.
            </p>
            <div className="space-y-2">
              {usersQuery.data.slice(0, 3).map((user) => (
                <div key={user.id} className="flex items-center justify-between rounded border px-3 py-2 text-sm">
                  <div>
                    <p className="font-medium">{user.email}</p>
                    <p className="text-xs text-muted-foreground">{user.id}</p>
                  </div>
                  <Badge variant="outline">{user.role ?? 'member'}</Badge>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function GateAction({
  label,
  action,
  variant = 'outline',
}: {
  label: string;
  action: string;
  variant?: 'outline' | 'destructive';
}) {
  return (
    <div className="flex items-center justify-between rounded border px-3 py-2">
      <span className="font-mono text-xs">{label}</span>
      <Button  variant={variant} onClick={() => alert(`${action} clicked`)}>
        {action}
      </Button>
    </div>
  );
}
