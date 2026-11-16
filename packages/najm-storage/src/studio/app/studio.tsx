'use client';
import React, { useSyncExternalStore } from 'react';
import { NajmThemeProvider, NPortalScopeProvider, Toaster } from 'najm-kit';
import { StorageStudioApp } from './App';
import type { StorageStudioProps } from '../providers/types';

const subscribeNoop = () => () => {};

/**
 * The studio is a client-only SPA (client router, window.location), so it
 * renders nothing on the server and mounts after hydration, like RAG Studio.
 * Rendering its router during SSR produced a hydration mismatch in Next hosts.
 */
function useIsClient() {
  return useSyncExternalStore(subscribeNoop, () => true, () => false);
}

export function StorageStudio({ inheritTheme = false }: StorageStudioProps) {
  const isClient = useIsClient();
  return (
    <NPortalScopeProvider className="ss-studio">
      <NajmThemeProvider
        mode="dark"
        accent="emerald"
        accentOnly={inheritTheme}
        // `dark` on the provider element itself: kit's `.dark` rule re-declares
        // every token, so on a nested wrapper it overrode the inline emerald
        // accent and `text-primary` went near-black.
        className="ss-studio dark h-full w-full"
      >
        {isClient ? (
          <>
            <StorageStudioApp />
            <Toaster richColors position="bottom-right" />
          </>
        ) : null}
      </NajmThemeProvider>
    </NPortalScopeProvider>
  );
}
