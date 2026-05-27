'use client';

import React from 'react';
import { NajmThemeProvider, NPortalScopeProvider } from 'najm-ui';
import 'najm-ui/styles.css';
import { RagStudioApp } from './App';
import { ChatDraftsProvider } from '@/lib/chatDraftsContext';

export function RagStudio() {
  return (
    <NPortalScopeProvider className="rs-studio">
      <NajmThemeProvider preset="dark-violet" className="rs-studio h-full w-full">
        <ChatDraftsProvider>
          <RagStudioApp />
        </ChatDraftsProvider>
      </NajmThemeProvider>
    </NPortalScopeProvider>
  );
}
