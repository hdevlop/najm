'use client';

import { useRouter } from 'next/navigation';
import {
  useUser,
  useSession,
  UserAvatar,
  UserName,
  UserEmail,
  UserRole,
  SignOutButton,
} from 'najm-auth/client/react';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';

export function ProfileSection() {
  const user = useUser();
  const { status } = useSession();
  const router = useRouter();

  if (!user) return null;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <UserAvatar size={64} />
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">
            <UserName fallback="Anonymous" />
          </h3>
          <p className="text-sm text-muted-foreground">
            <UserEmail fallback="No email" />
          </p>
        </div>
      </div>

      <Separator />

      <div className="grid gap-3 text-sm">
        <div className="flex justify-between">
          <span className="font-medium">User ID</span>
          <span className="font-mono text-muted-foreground">{user.id}</span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium">Role</span>
          <span className="text-muted-foreground">
            <UserRole fallback="No role" />
          </span>
        </div>
        <div className="flex justify-between">
          <span className="font-medium">Session</span>
          <span className="text-muted-foreground capitalize">{status}</span>
        </div>
      </div>

      <Separator />

      <SignOutButton onSuccess={() => router.replace('/login')}>
        <Button variant="destructive" className="w-full">
          Sign Out
        </Button>
      </SignOutButton>
    </div>
  );
}
