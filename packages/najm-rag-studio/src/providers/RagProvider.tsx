'use client';

import React from 'react';
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
      <div className={appearance?.className} style={appearance?.style}>
        {children}
      </div>
    </RagStudioContext.Provider>
  );
}

export { useRagStudio } from '../lib/context';