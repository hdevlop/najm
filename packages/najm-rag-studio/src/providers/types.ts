import type { ReactNode } from 'react';

export interface AppearanceConfig {
  className?: string;
  style?: React.CSSProperties;
}

export interface RagStudioProviderProps {
  apiBase: string;
  /** Pathname where the studio is mounted in the host app (e.g. "/rag-studio").
   *  Used as the prefix for all client-side URL updates. Defaults to auto-detect. */
  basePath?: string;
  getAuthHeaders?: () => HeadersInit;
  chatbotSettingsUrl?: string;
  chatbotSettingsApiPath?: string | null;
  chatbotSettingsTestApiPath?: string;
  appearance?: AppearanceConfig;
  children: ReactNode;
}