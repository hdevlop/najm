import React, { useCallback, useEffect, useState } from 'react';
import { Sparkles } from 'lucide-react';
import { NSidebar, NInspectorSheet, NErrorBoundary } from 'najm-ui';
import { SettingsSheet } from '@/features/settings/components/SettingsSheet';
import { EmbeddingHealthRoot } from '@/shared/components/EmbeddingHealthRoot';
import { StudioAssistant } from '@/features/assistant';
import { WorkspaceRouter } from '@/app/components/WorkspaceRouter';
import { useWorkspace } from '@/shared/hooks/useWorkspace';
import { useInspector } from '@/app/hooks/useInspector';
import { useUnmatchedInbox } from '@/app/hooks/useUnmatchedInbox';
import { useStudioSettings } from '@/app/hooks/useStudioSettings';
import { useRefreshBuckets } from '@/app/hooks/useRefreshBuckets';
import { useNavItems } from '@/app/hooks/useNavItems';

export function RagStudioApp() {
  const { activeWorkspace, setActiveWorkspace } = useWorkspace();
  const { enableKnowledge, setSettings } = useStudioSettings();
  const { onAssistantToolResult, onDependenciesChange } = useRefreshBuckets();
  const { inspectorOpen, inspectorContent, handleCitationClick, closeInspector } = useInspector();
  const {
    unmatchedCount, unmatchedItems, unmatchedTools, unmatchedLoading,
    loadUnmatchedInbox, mapUnmatched, discardUnmatched,
  } = useUnmatchedInbox({ enabled: activeWorkspace === 'logs-unmatched' });

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [viewContext, setViewContext] = useState<Record<string, unknown>>({});
  const [workspaceResetNonce, setWorkspaceResetNonce] = useState(0);

  useEffect(() => {
    if (!enableKnowledge && activeWorkspace.startsWith('knowledge-')) {
      setActiveWorkspace('routing-lab');
    }
  }, [activeWorkspace, enableKnowledge, setActiveWorkspace]);

  useEffect(() => {
    if (activeWorkspace === 'dashboard' || activeWorkspace === 'chat' || activeWorkspace.startsWith('logs')) {
      setViewContext({});
    }
  }, [activeWorkspace]);

  const navItems = useNavItems({ enableKnowledge, unmatchedCount });
  const handleNavigate = useCallback((href: string) => {
    const nextWorkspace = href as typeof activeWorkspace;
    if (nextWorkspace === activeWorkspace) {
      setWorkspaceResetNonce((nonce) => nonce + 1);
      return;
    }
    setActiveWorkspace(nextWorkspace);
  }, [activeWorkspace, setActiveWorkspace]);

  return (
    <>
      <EmbeddingHealthRoot />
      <div className="dark h-full w-full">
        <div className="flex h-full w-full overflow-hidden bg-bg">
          <NSidebar
            logoIcon={Sparkles}
            logoTitle="RAG Studio"
            logoSubtitle="Knowledge Management"
            navItems={navItems}
            activePath={activeWorkspace}
            onNavigate={handleNavigate}
            onLogoClick={() => setActiveWorkspace('dashboard')}
            showSectionIcons={false}
            showSectionSeparators
            onSettings={() => setSettingsOpen(true)}
          />

          <main className="flex-1 h-full overflow-hidden flex flex-col min-w-0">
            <NErrorBoundary fallbackTitle="Workspace error">
              <WorkspaceRouter
                activeWorkspace={activeWorkspace}
                setActiveWorkspace={setActiveWorkspace}
                workspaceResetNonce={workspaceResetNonce}
                enableKnowledge={enableKnowledge}
                onViewContextChange={setViewContext}
                onCitationClick={handleCitationClick}
                onOpenSettings={() => setSettingsOpen(true)}
                unmatched={{
                  items: unmatchedItems,
                  tools: unmatchedTools,
                  loading: unmatchedLoading,
                  onRefresh: loadUnmatchedInbox,
                  onMap: mapUnmatched,
                  onDiscard: discardUnmatched,
                }}
              />
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
      {activeWorkspace !== 'chat' && (
        <StudioAssistant
          activeWorkspace={activeWorkspace}
          viewContext={viewContext}
          onToolResult={onAssistantToolResult}
        />
      )}
    </>
  );
}
