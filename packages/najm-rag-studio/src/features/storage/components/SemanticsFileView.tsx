import React, { useEffect, useRef, useState } from 'react';
import { useLocalStorageState } from 'najm-ui';
import { SemanticsEditor } from '@/features/routing-semantics';
import { useSemanticsWorkspace } from '@/features/routing-semantics/hooks/useSemanticsWorkspace';
import { useToolsWorkspace } from '@/features/routing-tools/hooks/useToolsWorkspace';
import { defaultJsonViewColors } from '@/features/routing-semantics/utils/json-view-presets';
import type { JsonViewColors } from '@/features/routing-tools/types';
import type { SemanticsViewMode } from '@/features/routing-semantics/types';

interface SemanticsFileViewProps {
  group: string;
  lang: string;
  top?: React.ReactNode;
}

export function SemanticsFileView({ group, lang, top }: SemanticsFileViewProps) {
  const [jsonViewColors, setJsonViewColors] = useLocalStorageState<JsonViewColors>(
    'najm-rag-studio:jsonViewColors',
    defaultJsonViewColors,
  );
  const tools = useToolsWorkspace();
  const semantics = useSemanticsWorkspace();
  const [viewMode, setViewMode] = useState<SemanticsViewMode>('json');

  const lockedRef = useRef<string | null>(null);
  useEffect(() => {
    const key = `${group}|${lang}`;
    if (lockedRef.current === key) return;
    lockedRef.current = key;
    semantics.setToolGroupFilter(group);
    semantics.setToolFilter('');
    semantics.setLangFilter(lang);
    semantics.setSearchQuery('');
  }, [group, lang, semantics]);

  return (
    <SemanticsEditor
      phrases={semantics.phrases}
      loading={semantics.loading}
      onSave={semantics.handleSavePhrase}
      onDelete={semantics.handleDeletePhrase}
      onClearAll={semantics.handleClearAllSemantics}
      onDeleteBatch={semantics.handleDeleteSemanticsBatch}
      onReindexAll={semantics.handleReindexSemantics}
      onExport={semantics.handleExportSemantics}
      onImport={semantics.handleImportSemantics}
      onImportFiles={semantics.handleImportFiles}
      onPollImportJob={semantics.pollImportJob}
      onImportComplete={semantics.refreshPhrases}
      availableTools={tools.visibleTools}
      toolGroups={tools.toolGroups}
      toolGroupByName={tools.toolGroupByName}
      allowedLangs={semantics.allowedLangs}
      toolGroupFilter={semantics.toolGroupFilter}
      toolFilter={semantics.toolFilter}
      langFilter={semantics.langFilter}
      searchQuery={semantics.searchQuery}
      langGroups={semantics.langGroups}
      totalPhrases={semantics.totalPhrases}
      pagination={semantics.pagination}
      onPaginationChange={semantics.setPagination}
      pageCount={semantics.pageCount}
      rowCount={semantics.rowCount}
      rowSelection={semantics.rowSelection}
      onRowSelectionChange={semantics.setRowSelection}
      onToolGroupFilterChange={(val) => {
        semantics.setToolGroupFilter(val);
        semantics.setToolFilter('');
        semantics.setLangFilter('');
      }}
      onToolFilterChange={(val) => { semantics.setToolFilter(val); semantics.setLangFilter(''); }}
      onLangFilterChange={semantics.setLangFilter}
      onSearchChange={semantics.setSearchQuery}
      semanticsViewMode={viewMode}
      onViewModeChange={setViewMode}
      jsonViewColors={jsonViewColors}
      onJsonViewColorsChange={setJsonViewColors}
      subtitle={`${group} / ${lang}.json`}
      top={top}
      showToolGroupFilter={false}
      showToolFilter={false}
      showLangFilter={false}
      showBulkAdd={false}
      showClearAll={false}
      showDeleteBatch
      showRowSelection
      responsiveCards={false}
    />
  );
}
