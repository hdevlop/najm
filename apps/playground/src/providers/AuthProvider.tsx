'use client';

import { type ReactNode } from 'react';
import { AuthProvider } from 'najm-auth/client/react';
import { auth } from '@/lib/auth';

export function AuthProviderWrapper({ children }: { children: ReactNode }) {
  return <AuthProvider client={auth.client}>{children}</AuthProvider>;
}