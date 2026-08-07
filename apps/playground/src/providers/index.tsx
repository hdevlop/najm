export { QueryProvider } from './QueryProvider';
export { AuthProviderWrapper } from './AuthProvider';

import { type ReactNode } from 'react';
import type { ServerSession } from 'najm-auth/client/server';
import { QueryProvider } from './QueryProvider';
import { AuthProviderWrapper } from './AuthProvider';

export function AppProviders({
  children,
  initialSession,
}: {
  children: ReactNode;
  initialSession: ServerSession | null;
}) {
  return (
    <QueryProvider>
      <AuthProviderWrapper initialSession={initialSession}>
        {children}
      </AuthProviderWrapper>
    </QueryProvider>
  );
}