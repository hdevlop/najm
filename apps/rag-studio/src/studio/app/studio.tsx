'use client';

import React from 'react';
import { NajmThemeProvider, NPortalScopeProvider } from 'najm-kit';
import { RagStudioApp } from './App';
import { ChatDraftsProvider } from '@/lib/chatDraftsContext';
import type { RagStudioProps } from '../providers/types';

export function RagStudio({ inheritTheme = false }: RagStudioProps) {
  return (
    <NPortalScopeProvider className="rs-studio">
      <NajmThemeProvider
        mode="dark"
        accent="violet"
        accentOnly={inheritTheme}
        className="rs-studio h-full w-full"
      >
        <ChatDraftsProvider>
          <RagStudioApp />
        </ChatDraftsProvider>
      </NajmThemeProvider>
    </NPortalScopeProvider>
  );
}
