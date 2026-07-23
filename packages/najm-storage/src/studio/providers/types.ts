import type { ReactNode } from 'react';

export interface StorageStudioProviderProps {
  apiBase: string;
  storageApiBase?: string;
  getAuthHeaders?: () => Record<string, string>;
  onUnauthorized?: () => void;
  basePath?: string;
  children: ReactNode;
}

export interface StorageStudioProps {
  /** Pass true when embedding inside a parent app that provides its own design tokens.
   *  The studio will only apply its accent color and inherit everything else. */
  inheritTheme?: boolean;
}
