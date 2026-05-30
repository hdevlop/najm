'use client';

import React from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RagStudioContext } from '../lib/context';
import type { RagStudioProviderProps } from './types';

export function RagStudioProvider({
  apiBase,
  basePath,
  getAuthHeaders,
  chatbotSettingsUrl,
  chatbotSettingsApiPath,
  chatbotSettingsTestApiPath,
  appearance,
  children,
}: RagStudioProviderProps) {
  const normalizedBasePath = basePath?.replace(/\/+$/, '') || '';
  const [queryClient] = React.useState(() => new QueryClient({
    defaultOptions: {
      queries: {
        retry: 1,
        refetchOnWindowFocus: false,
      },
    },
  }));

  const value = React.useMemo(
    () => ({
      apiBase,
      getAuthHeaders: getAuthHeaders ?? (() => ({})),
      chatbotSettingsUrl,
      chatbotSettingsApiPath,
      chatbotSettingsTestApiPath,
      basePath: normalizedBasePath,
    }),
    [apiBase, getAuthHeaders, chatbotSettingsUrl, chatbotSettingsApiPath, chatbotSettingsTestApiPath, normalizedBasePath]
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
