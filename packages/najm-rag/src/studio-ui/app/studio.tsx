'use client';

import React, { useSyncExternalStore } from 'react';
import { NajmThemeProvider, NPortalScopeProvider } from 'najm-kit';
import { RagStudioApp } from './App';
import { ChatDraftsProvider } from '@/lib/chatDraftsContext';
import type { RagStudioProps } from '../providers/types';

const subscribeNoop = () => () => {};

/**
 * The studio is a client-only SPA (client router, window.location, browser
 * storage), so it renders nothing on the server and mounts after hydration.
 * Hosts can embed it in a server-rendered page without `ssr: false`.
 */
function useIsClient() {
  return useSyncExternalStore(subscribeNoop, () => true, () => false);
}

export function RagStudio({ inheritTheme = false }: RagStudioProps) {
  const isClient = useIsClient();

  return (
    <NPortalScopeProvider className="rs-studio">
      <NajmThemeProvider
        mode="dark"
        accent="violet"
        accentOnly={inheritTheme}
        className="rs-studio h-full w-full"
      >
        {isClient ? (
          <ChatDraftsProvider>
            <RagStudioApp />
          </ChatDraftsProvider>
        ) : null}
      </NajmThemeProvider>
    </NPortalScopeProvider>
  );
}
