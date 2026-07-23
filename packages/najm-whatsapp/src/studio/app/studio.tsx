'use client';
import React from 'react';
import { NajmThemeProvider, NPortalScopeProvider, Toaster } from 'najm-kit';
import { WhatsAppStudioApp } from './App';
import type { WhatsAppStudioProps } from '../providers/types';

export function WhatsAppStudio({ inheritTheme = false }: WhatsAppStudioProps) {
  return (
    <NPortalScopeProvider className="wa-studio">
      <NajmThemeProvider
        mode="dark"
        accent="green"
        accentOnly={inheritTheme}
        className="wa-studio h-full w-full"
      >
        <WhatsAppStudioApp />
        <Toaster richColors position="bottom-right" />
      </NajmThemeProvider>
    </NPortalScopeProvider>
  );
}
