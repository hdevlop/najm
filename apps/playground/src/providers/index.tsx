export { QueryProvider } from './QueryProvider';
export { AuthProviderWrapper } from './AuthProvider';

import { type ReactNode } from 'react';
import type { ServerSession } from 'najm-auth/client/server';
import type { NajmMode } from 'najm-kit';
import { QueryProvider } from './QueryProvider';
import { AuthProviderWrapper } from './AuthProvider';
import { UIProvider } from './UIProvider';

export function AppProviders({
  children,
  initialSession,
  initialTheme,
}: {
  children: ReactNode;
  initialSession: ServerSession | null;
  initialTheme: NajmMode;
}) {
  return (
    <QueryProvider>
      <AuthProviderWrapper initialSession={initialSession}>
        <UIProvider initialTheme={initialTheme}>{children}</UIProvider>
      </AuthProviderWrapper>
    </QueryProvider>
  );
}
