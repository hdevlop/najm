'use client';
import React from 'react';
import { NajmThemeProvider, NPortalScopeProvider, Toaster } from 'najm-kit';
import { StorageStudioApp } from './App';
import type { StorageStudioProps } from '../providers/types';

export function StorageStudio({ inheritTheme = false }: StorageStudioProps) {
  return (
    <NPortalScopeProvider className="ss-studio">
      <NajmThemeProvider
        mode="dark"
        accent="emerald"
        accentOnly={inheritTheme}
        className="ss-studio h-full w-full"
      >
        <StorageStudioApp />
        <Toaster richColors position="bottom-right" />
      </NajmThemeProvider>
    </NPortalScopeProvider>
  );
}
