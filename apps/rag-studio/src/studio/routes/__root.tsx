import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { createRootRouteWithContext, Outlet, useNavigate, useRouter, useRouterState } from '@tanstack/react-router';
import { Sparkles } from 'lucide-react';
import { NSidebar, NInspectorSheet, NErrorBoundary } from 'najm-kit';
import { SettingsSheet } from '@/features/settings/components/SettingsSheet';
import { EmbeddingHealthRoot } from '@/shared/components/EmbeddingHealthRoot';
import { StudioAssistant } from '@/features/assistant';
import { useInspector } from '@/features/knowledge/hooks/useInspector';
import { useUnmatchedInbox } from '@/features/logs/hooks/useUnmatchedInbox';
import { useStudioSettings } from '@/features/settings/hooks/useStudioSettings';
import { useRefreshBuckets } from '@/features/assistant/hooks/useRefreshBuckets';
import { useNavItems } from '@/features/dashboard/hooks/useNavItems';

interface RouteCallbacks {
  onCitationClick: (chunkId: string, documentId: string) => void;
  onViewContextChange: (ctx: Record<string, unknown>) => void;
  resetNonce: number;
  openSettings: () => void;
}

const RouteCallbacksContext = createContext<RouteCallbacks>({
  onCitationClick: () => {},
  onViewContextChange: () => {},
  resetNonce: 0,
  openSettings: () => {},
});

export function useRouteCallbacks() {
  return useContext(RouteCallbacksContext);
}

const NAV_ID_TO_PATH: Record<string, string> = {
  dashboard: '/',
  'knowledge-documents': '/knowledge/documents',
  'knowledge-chunks': '/knowledge/chunks',
  'knowledge-chat': '/knowledge/chat',
  'routing-tools': '/tools',
  'routing-semantics': '/semantics',
  'routing-lab': '/lab',
  'routing-tests': '/tests',
  chat: '/chat',
  logs: '/logs',
  'logs-unmatched': '/unmatched',
  'storage-semantics': '/semantics',
  'storage-tests': '/tests',
};

export { NAV_ID_TO_PATH };

export function pathnameToNavId(pathname: string, basePath: string): string {
  const rel = basePath && pathname.startsWith(basePath) ? pathname.slice(basePath.length) || '/' : pathname;
  const segment = rel.replace(/\/+$/, '') || '/';
  for (const [id, path] of Object.entries(NAV_ID_TO_PATH)) {
    if (path === segment) return id;
  }
  return 'dashboard';
}

export interface StudioRouterContext {
  enableKnowledge: boolean;
}

export const rootRoute = createRootRouteWithContext<StudioRouterContext>()({
  component: RootLayout,
});

function RootLayout() {
  const navigate = useNavigate();
  const router = useRouter();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const basePath = router.basepath ?? '';
  const activeNavId = pathnameToNavId(pathname, basePath);

  const { enableKnowledge, setSettings } = useStudioSettings();
  const { onAssistantToolResult, onDependenciesChange } = useRefreshBuckets();
  const { inspectorOpen, inspectorContent, handleCitationClick, closeInspector } = useInspector();
  const { unmatchedCount } = useUnmatchedInbox({ enabled: activeNavId === 'logs-unmatched' });

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [viewContext, setViewContext] = useState<Record<string, unknown>>({});
  const [resetNonce, setResetNonce] = useState(0);

  useEffect(() => {
    if (activeNavId === 'dashboard' || activeNavId === 'chat' || activeNavId.startsWith('logs')) {
      setViewContext({});
    }
  }, [activeNavId]);

  const navItems = useNavItems({ enableKnowledge, unmatchedCount });

  const handleNavigate = useCallback((href: string) => {
    const targetPath = NAV_ID_TO_PATH[href] ?? '/';
    const currentPath = NAV_ID_TO_PATH[activeNavId] ?? '/';
    if (targetPath === currentPath) {
      setResetNonce((n) => n + 1);
      return;
    }
    navigate({ to: targetPath });
  }, [activeNavId, navigate]);

  const callbacks = useMemo<RouteCallbacks>(() => ({
    onCitationClick: handleCitationClick,
    onViewContextChange: setViewContext,
    resetNonce,
    openSettings: () => setSettingsOpen(true),
  }), [handleCitationClick, resetNonce]);

  return (
    <RouteCallbacksContext.Provider value={callbacks}>
      <EmbeddingHealthRoot />
      <div className="dark h-full w-full">
        <div className="flex h-full w-full overflow-hidden bg-bg">
          <NSidebar
            logoIcon={Sparkles}
            logoTitle="RAG Studio"
            logoSubtitle="Knowledge Management"
            navItems={navItems}
            activePath={activeNavId}
            onNavigate={handleNavigate}
            onLogoClick={() => navigate({ to: '/' })}
            showSectionIcons={false}
            showSectionSeparators
            onSettings={() => setSettingsOpen(true)}
          />
          <main className="flex-1 h-full overflow-hidden flex flex-col min-w-0">
            <NErrorBoundary fallbackTitle="Workspace error">
              <Outlet />
            </NErrorBoundary>
          </main>
          {inspectorContent && (
            <NInspectorSheet
              open={inspectorOpen}
              onClose={closeInspector}
              title={inspectorContent.title}
            >
              {inspectorContent.content}
            </NInspectorSheet>
          )}
        </div>
      </div>
      <SettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        onSettingsChange={setSettings}
        onDependenciesChange={onDependenciesChange}
      />
      {activeNavId !== 'chat' && (
        <StudioAssistant
          activeWorkspace={activeNavId}
          viewContext={viewContext}
          onToolResult={onAssistantToolResult}
        />
      )}
    </RouteCallbacksContext.Provider>
  );
}
