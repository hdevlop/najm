import { createContext, useContext } from 'react';

export interface RagStudioContextValue {
  apiBase: string;
  getAuthHeaders: () => HeadersInit;
  chatbotSettingsUrl?: string;
  chatbotSettingsApiPath?: string | null;
  chatbotSettingsTestApiPath?: string;
  basePath: string;
}

export const RagStudioContext = createContext<RagStudioContextValue>({
  apiBase: '/api/rag-studio',
  getAuthHeaders: () => ({}),
  basePath: '',
});

export function useRagStudio() {
  return useContext(RagStudioContext);
}
