export { QueryProvider } from './QueryProvider';
export { AuthProviderWrapper } from './AuthProvider';

import { type ReactNode } from 'react';
import { QueryProvider } from './QueryProvider';
import { AuthProviderWrapper } from './AuthProvider';

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryProvider>
      <AuthProviderWrapper>
        {children}
      </AuthProviderWrapper>
    </QueryProvider>
  );
}