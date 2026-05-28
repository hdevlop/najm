import React, { createContext, useContext, useMemo } from 'react';
import type { StorageStudioProviderProps } from './types';

interface StudioContextValue {
  apiBase: string;
  storageApiBase: string;
  getAuthHeaders: () => Record<string, string>;
  onUnauthorized?: () => void;
  basePath: string;
}

const StudioContext = createContext<StudioContextValue | null>(null);

export function StorageStudioProvider({
  apiBase,
  storageApiBase,
  getAuthHeaders = () => ({}),
  onUnauthorized,
  basePath,
  children,
}: StorageStudioProviderProps) {
  const normalizedBasePath = basePath?.replace(/\/+$/, '') || '';
  const value = useMemo(
    () => ({ apiBase, storageApiBase: storageApiBase ?? apiBase, getAuthHeaders, onUnauthorized, basePath: normalizedBasePath }),
    [apiBase, storageApiBase, getAuthHeaders, onUnauthorized, normalizedBasePath]
  );
  return <StudioContext.Provider value={value}>{children}</StudioContext.Provider>;
}

export function useStudio() {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error('useStudio must be inside StorageStudioProvider');
  return ctx;
}

export function useStorageApi() {
  const ctx = useContext(StudioContext);
  if (!ctx) throw new Error('useStorageApi must be inside StorageStudioProvider');
  return { apiBase: ctx.storageApiBase, getAuthHeaders: ctx.getAuthHeaders };
}