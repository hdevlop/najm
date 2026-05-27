'use client';

import React from 'react';
import { RagStudioContext } from '../lib/context';
import { setStudioBasePath } from '../shared/utils/studioBasePath';
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
  if (basePath !== undefined) setStudioBasePath(basePath);
  const value = React.useMemo(
    () => ({
      apiBase,
      getAuthHeaders: getAuthHeaders ?? (() => ({})),
      chatbotSettingsUrl,
      chatbotSettingsApiPath,
      chatbotSettingsTestApiPath,
    }),
    [apiBase, getAuthHeaders, chatbotSettingsUrl, chatbotSettingsApiPath, chatbotSettingsTestApiPath]
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