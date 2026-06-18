import { createContext, useContext } from 'react';
import type { StudioAuthMode } from '../providers/types';

export interface RagStudioContextValue {
  apiBase: string;
  getAuthHeaders: () => HeadersInit;
  chatbotSettingsUrl?: string;
  chatbotSettingsApiPath?: string | null;
  chatbotSettingsTestApiPath?: string;
  basePath: string;
  /** Auth mode: 'session' (host cookies) or 'standalone' (own Bearer login). */
  auth: StudioAuthMode;
  /** Base URL for najm-auth endpoints (/login, /refresh) in standalone mode. */
  authApiBase: string;
}

export const RagStudioContext = createContext<RagStudioContextValue>({
  apiBase: '/api/rag-studio',
  getAuthHeaders: () => ({}),
  basePath: '',
  auth: 'session',
  authApiBase: '/api/auth',
});

export function useRagStudio() {
  return useContext(RagStudioContext);
}
