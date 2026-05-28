import type { ReactNode } from 'react';

export interface StorageStudioProviderProps {
  apiBase: string;
  storageApiBase?: string;
  getAuthHeaders?: () => Record<string, string>;
  onUnauthorized?: () => void;
  basePath?: string;
  children: ReactNode;
}

export interface StorageStudioProps {}
