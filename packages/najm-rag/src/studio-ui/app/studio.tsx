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
        // `dark` sits on the provider element itself: kit's `.dark` rule
        // re-declares every token, so on a nested wrapper it would override
        // the inline accent tokens set here (violet primary went near-black).
        className="rs-studio dark h-full w-full"
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
