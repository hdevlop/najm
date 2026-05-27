'use client';
import React from 'react';
import { NajmThemeProvider, NPortalScopeProvider, Toaster } from 'najm-ui';
import 'najm-ui/styles.css';
import { StorageStudioApp } from './App';

export function StorageStudio() {
  return (
    <NPortalScopeProvider className="ss-studio">
      <NajmThemeProvider preset="dark-slate" className="ss-studio h-full w-full">
        <StorageStudioApp />
        <Toaster richColors position="bottom-right" />
      </NajmThemeProvider>
    </NPortalScopeProvider>
  );
}
