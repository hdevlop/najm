'use client';

import { type ReactNode } from 'react';
import { AuthProvider } from 'najm-auth/client/react';
import type { ServerSession } from 'najm-auth/client/server';
import { auth } from '@/lib/auth';

export function AuthProviderWrapper({
  children,
  initialSession,
}: {
  children: ReactNode;
  initialSession: ServerSession | null;
}) {
  return (
    <AuthProvider client={auth.client} initialSession={initialSession}>
      {children}
    </AuthProvider>
  );
}