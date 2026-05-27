'use client';
import React from 'react';
import { NajmThemeProvider, NPortalScopeProvider, Toaster } from 'najm-ui';
import 'najm-ui/styles.css';
import { WhatsAppStudioApp } from './App';

export function WhatsAppStudio() {
  return (
    <NPortalScopeProvider className="wa-studio">
      <NajmThemeProvider preset="dark-green" className="wa-studio h-full w-full">
        <WhatsAppStudioApp />
        <Toaster richColors position="bottom-right" />
      </NajmThemeProvider>
    </NPortalScopeProvider>
  );
}
