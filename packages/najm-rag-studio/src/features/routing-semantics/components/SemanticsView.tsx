import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { SemanticsEditor } from './SemanticsEditor';
import { SemanticBanner } from './SemanticBanner';
import { SettingsSheet } from '@/features/settings/components/SettingsSheet';
import { useSemanticsWorkspace } from '../hooks/useSemanticsWorkspace';
import { useToolsWorkspace } from '@/features/routing-tools/hooks/useToolsWorkspace';
import { useBanner } from '@/shared/hooks/useBanner';
import { useLocalStorageState } from 'najm-ui';
import { NErrorBoundary } from 'najm-ui';
import { useCrossFeatureDrafts } from '@/features/chat/hooks/useCrossFeatureDrafts';
import type { JsonViewColors, SemanticsViewMode } from '@/features/routing-semantics/types';
import { defaultJsonViewColors } from '../utils/json-view-presets';
import type { PendingSemanticDraft } from '@/lib/chatDraftsContext';

interface SemanticsViewProps {
  onViewContextChange?: (context: Record<string, unknown>) => void;
  resetNonce?: number;
  initialView?: 'table' | 'json' | 'files';
  initialGroup?: string;
  initialLang?: string;
  onSearchStateChange?: (state: { view?: string; group?: string; lang?: string }) => void;
}

function getStoredFileViewMode(
  key: string,
  legacyKey: string,
  fallback: 'table' | 'json' | 'files' = 'table',
): 'table' | 'json' | 'files' {
  if (typeof window === 'undefined') return fallback;
  for (const candidateKey of [key, legacyKey]) {
    try {
      const raw = window.localStorage.getItem(candidateKey);
      if (!raw) continue;
      const parsed = JSON.parse(raw);
      if (['table', 'json', 'files'].includes(parsed)) return parsed;
    } catch {
      // Ignore malformed localStorage values.
    }
  }
  return fallback;
}

export function SemanticsView({ onViewContextChange, resetNonce, initialView, initialGroup, initialLang, onSearchStateChange }: SemanticsViewProps) {
  const { banner, showBanner, dismissBanner } = useBanner();
  const { consumeSemanticDraft } = useCrossFeatureDrafts(() => {});

  const [consumedSemanticDraft, setConsumedSemanticDraft] = useState<PendingSemanticDraft | null>(null);

  const [jsonViewColors, setJsonViewColors] = useLocalStorageState<JsonViewColors>(
    'najm-rag-studio:jsonViewColors',
    defaultJsonViewColors,
  );
  const [semanticsViewMode, setSemanticsViewMode] = useLocalStorageState<SemanticsViewMode>(
    'najm-rag-studio:semantics:view-mode',
    (initialView ?? getStoredFileViewMode(
      'najm-rag-studio:semantics:view-mode',
      'najm-rag-studio:semanticsViewMode',
      'table',
    )) as SemanticsViewMode,
  );

  const [settingsOpen, setSettingsOpen] = useLocalStorageState<boolean>(
    'najm-rag-studio:settingsOpen',
    false,
  );

  const {
    phrases,
    loading: semanticsLoading,
    toolGroupFilter,
    toolFilter,
    langFilter,
    searchQuery,
    langGroups,
    totalPhrases,
    allowedLangs,
    pagination,
    setPagination,
    pageCount,
    rowCount,
    rowSelection,
    setRowSelection,
    setToolGroupFilter,
    setToolFilter,
    setLangFilter,
    setSearchQuery,
    refreshPhrases,
    handleSavePhrase,
    handleReindexSemantics,
    handleExportSemantics,
    handleImportSemantics,
    handleImportFiles,
    pollImportJob,
    handleDeletePhrase,
    handleDeleteSemanticsBatch,
    handleClearAllSemantics,
  } = useSemanticsWorkspace();

  useEffect(() => {
    if (!initialGroup && !initialLang) return;
    setSearchQuery('');
    setToolFilter('');
    setToolGroupFilter(initialGroup ?? '');
    setLangFilter(initialLang ?? '');
  }, [initialGroup, initialLang, setLangFilter, setSearchQuery, setToolFilter, setToolGroupFilter]);

  useEffect(() => {
    onSearchStateChange?.({
      view: semanticsViewMode,
      group: toolGroupFilter || undefined,
      lang: langFilter || undefined,
    });
  }, [semanticsViewMode, toolGroupFilter, langFilter, onSearchStateChange]);

  useEffect(() => {
    if (!resetNonce) return;
    setSearchQuery('');
    setToolFilter('');
    setToolGroupFilter('');
    setLangFilter('');
  }, [resetNonce, setLangFilter, setSearchQuery, setToolFilter, setToolGroupFilter]);

  const handleSemanticsViewModeChange = useCallback((mode: SemanticsViewMode) => {
    setSemanticsViewMode(mode);
  }, [setSemanticsViewMode]);

  const {
    toolGroups,
    toolGroupByName,
    visibleTools,
  } = useToolsWorkspace((msg) => showBanner('error', msg));

  useEffect(() => {
    const draft = consumeSemanticDraft();
    if (draft) setConsumedSemanticDraft(draft);
  }, [consumeSemanticDraft]);

  useEffect(() => {
    if (!onViewContextChange) return;
    onViewContextChange({
      filters: { toolGroupFilter, toolFilter, langFilter, searchQuery },
      totalPhrases,
      allowedLangs,
    });
  }, [
    toolGroupFilter,
    toolFilter,
    langFilter,
    searchQuery,
    totalPhrases,
    allowedLangs,
    onViewContextChange,
  ]);

  return (
    <div className="flex flex-col h-full">
      <SettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        jsonViewColors={jsonViewColors}
        onJsonViewColorsChange={setJsonViewColors}
      />
      <div className="shrink-0">
        <SemanticBanner banner={banner} onDismiss={dismissBanner} />
      </div>
      <div className="flex-1 overflow-hidden">
        <NErrorBoundary fallbackTitle="Routing view error">
          <SemanticsEditor
            phrases={phrases}
            loading={semanticsLoading}
            onSave={handleSavePhrase}
            onDelete={handleDeletePhrase}
            onClearAll={handleClearAllSemantics}
            onDeleteBatch={handleDeleteSemanticsBatch}
            onReindexAll={handleReindexSemantics}
            onExport={handleExportSemantics}
            onImport={handleImportSemantics}
            onImportFiles={handleImportFiles}
            onPollImportJob={pollImportJob}
            onImportComplete={refreshPhrases}
            availableTools={visibleTools}
            toolGroups={toolGroups}
            toolGroupByName={toolGroupByName}
            allowedLangs={allowedLangs}
            toolGroupFilter={toolGroupFilter}
            toolFilter={toolFilter}
            langFilter={langFilter}
            searchQuery={searchQuery}
            langGroups={langGroups}
            totalPhrases={totalPhrases}
            pagination={pagination}
            onPaginationChange={setPagination}
            pageCount={pageCount}
            rowCount={rowCount}
            rowSelection={rowSelection}
            onRowSelectionChange={setRowSelection}
            onToolGroupFilterChange={(val) => {
              setToolGroupFilter(val);
              setToolFilter('');
              setLangFilter('');
            }}
            onToolFilterChange={(val) => {
              setToolFilter(val);
              setLangFilter('');
            }}
            onLangFilterChange={setLangFilter}
            onSearchChange={setSearchQuery}
            semanticsViewMode={semanticsViewMode}
            onViewModeChange={handleSemanticsViewModeChange}
            jsonViewColors={jsonViewColors}
            onJsonViewColorsChange={setJsonViewColors}
            pendingSemanticDraft={consumedSemanticDraft}
            subtitle={
              toolGroupFilter && langFilter
                ? `${toolGroupFilter} / ${langFilter}.json`
                : toolGroupFilter
                  ? `${toolGroupFilter} files`
                  : undefined
            }
          />
        </NErrorBoundary>
      </div>
    </div>
  );
}
