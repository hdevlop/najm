'use client';

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RagStudioContext } from '../lib/context';
import { authHeaders } from '../lib/authStore';
import type { RagStudioProviderProps } from './types';

function deriveAuthApiBase(apiBase: string, explicit?: string): string {
  if (explicit) return explicit;
  // ".../rag-studio" → ".../auth"; otherwise append "/auth" to the API root.
  return /\/rag-studio\/?$/.test(apiBase)
    ? apiBase.replace(/\/rag-studio\/?$/, '/auth')
    : `${apiBase.replace(/\/+$/, '')}/auth`;
}

export function RagStudioProvider({
  apiBase,
  basePath,
  getAuthHeaders,
  auth = 'session',
  authApiBase,
  chatbotSettingsUrl,
  chatbotSettingsApiPath,
  chatbotSettingsTestApiPath,
  appearance,
  children,
}: RagStudioProviderProps) {
  const normalizedBasePath = basePath?.replace(/\/+$/, '') || '';
  const resolvedAuthApiBase = deriveAuthApiBase(apiBase, authApiBase);
  const [queryClient] = React.useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  }));

  // In standalone mode the studio owns a Bearer token (authStore); in session mode
  // it relies on host cookies (and any headers the host passes).
  const resolvedGetAuthHeaders = auth === 'standalone'
    ? authHeaders
    : (getAuthHeaders ?? (() => ({})));

  const value = React.useMemo(
    () => ({
      apiBase,
      getAuthHeaders: resolvedGetAuthHeaders,
      chatbotSettingsUrl,
      chatbotSettingsApiPath,
      chatbotSettingsTestApiPath,
      basePath: normalizedBasePath,
      auth,
      authApiBase: resolvedAuthApiBase,
    }),
    [apiBase, resolvedGetAuthHeaders, chatbotSettingsUrl, chatbotSettingsApiPath, chatbotSettingsTestApiPath, normalizedBasePath, auth, resolvedAuthApiBase]
  );

  return (
    <RagStudioContext.Provider value={value}>
      <QueryClientProvider client={queryClient}>
        <div className={appearance?.className} style={appearance?.style}>
          {children}
        </div>
      </QueryClientProvider>
    </RagStudioContext.Provider>
  );
}

export { useRagStudio } from '../lib/context';
