'use client';

import React, { useEffect } from 'react';
import { NajmThemeProvider, NPortalScopeProvider } from 'najm-kit';
import { RagStudioProvider } from '../providers';
import { RagStudioApp } from './App';
import { ChatDraftsProvider } from '@/lib/chatDraftsContext';
import { setTokenScope } from '../lib/authStore';
import { useConnections } from '../lib/useConnections';
import { ConnectionsManager, ConnectionPill } from '../features/connections';
import type { RagStudioProps } from '../providers/types';

/**
 * The standalone RAG Studio tool: manages a list of target apps, lets the
 * operator switch between them from the UI, and runs the studio against the
 * selected app's API in standalone (Bearer login) mode.
 *
 * This is the entry to host once and point at any running najm app. For
 * embedding inside a single app, use `<RagStudio />` instead.
 */
export function RagStudioStandalone({ inheritTheme = false }: RagStudioProps) {
  const { connections, active, setActive, add, remove } = useConnections();

  // The SPA's client router must use the pathname it's mounted at as its base,
  // so it matches the browser URL (e.g. hosted at "/rag-standalone").
  const basePath =
    typeof window !== 'undefined' ? window.location.pathname.replace(/\/+$/, '') || '/' : '/';

  // Scope Bearer tokens per target app so switching keeps each app's session.
  useEffect(() => {
    setTokenScope(active?.id ?? 'default');
  }, [active?.id]);

  return (
    <NPortalScopeProvider className="rs-studio">
      <NajmThemeProvider
        mode="dark"
        accent="violet"
        accentOnly={inheritTheme}
        className="rs-studio h-full w-full"
      >
        {active ? (
          <RagStudioProvider
            key={active.id}
            apiBase={`${active.apiBaseUrl.replace(/\/+$/, '')}/rag-studio`}
            basePath={basePath}
            auth="standalone"
            appearance={{ className: 'h-full w-full' }}
          >
            <ChatDraftsProvider>
              <div className="relative h-full w-full">
                <RagStudioApp />
                <ConnectionPill name={active.name} onSwitch={() => setActive(null)} />
              </div>
            </ChatDraftsProvider>
          </RagStudioProvider>
        ) : (
          <ConnectionsManager
            connections={connections}
            onSelect={setActive}
            onAdd={add}
            onRemove={remove}
          />
        )}
      </NajmThemeProvider>
    </NPortalScopeProvider>
  );
}
