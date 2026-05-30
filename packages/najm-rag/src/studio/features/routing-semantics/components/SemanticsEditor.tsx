import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Tag, Table as TableIcon, Code2, FolderOpen } from 'lucide-react';
import { NPageHeader, NTable, NEmptyState, NSheet, useContextMenu } from 'najm-ui';
import type { RowSelectionState } from '@tanstack/react-table';
import type {
  SemanticPhraseResponse,
  SemanticsExportPayload,
  SemanticsImportResult,
  SemanticGroup,
  ImportJobState,
  JsonViewColors,
  SemanticsViewMode,
} from '@/features/routing-semantics/types';
import { ALL_LANG_OPTIONS } from '../constants';
import { getPendingCount, isValidSemanticsPayload } from '../utils/helpers';
import { useSemanticsFilters } from '../hooks';
import {
  SemanticFilters,
  ImportJobProgress,
  SemanticBanner,
  SemanticForm,
  SemanticBulkForm,
  SemanticsJsonView,
} from '.';

import { DeleteSelectedDialog, ClearAllDialog } from './SemanticsDialogs';
import { SemanticsToolbar } from './SemanticsToolbar';
import {
  useSemanticsEditorState,
  useSemanticsImportJob,
} from '../hooks/useSemanticsEditorState';
import { buildSemanticColumns } from './columns';
import { makeSemanticCard } from './SemanticCard';
import { SemanticsFilesAdapter } from './SemanticsFilesAdapter';
import { LogicalFilesBreadcrumb } from '@/features/storage';

import type { PendingSemanticDraft } from '@/lib/chatDraftsContext';

interface SemanticsEditorProps {
  phrases: SemanticPhraseResponse[];
  loading: boolean;
  onSave: (phrase: Partial<SemanticPhraseResponse>) => Promise<SemanticPhraseResponse | null>;
  onDelete: (id: string) => void;
  onClearAll?: () => Promise<{ deleted: number } | void>;
  onDeleteBatch?: (ids: string[]) => Promise<{ deleted: number }>;
  onReindexAll?: () => Promise<void>;
  onExport?: () => Promise<SemanticsExportPayload>;
  onImport?: (payload: SemanticsExportPayload) => Promise<SemanticsImportResult>;
  onImportFiles?: (files: File[]) => Promise<ImportJobState>;
  onPollImportJob?: (jobId: string) => Promise<ImportJobState>;
  onImportComplete?: () => void | Promise<void>;
  availableTools?: string[];
  toolGroups?: Array<{ value: string; label: string; total: number }>;
  toolGroupByName?: Record<string, string>;
  allowedLangs?: string[];
  toolGroupFilter: string;
  toolFilter: string;
  langFilter: string;
  searchQuery: string;
  langGroups: SemanticGroup[];
  totalPhrases: number;
  pagination: { pageIndex: number; pageSize: number };
  onPaginationChange: (next: { pageIndex: number; pageSize: number }) => void;
  pageCount: number;
  rowCount: number;
  rowSelection: RowSelectionState;
  onRowSelectionChange: (next: RowSelectionState) => void;
  onToolGroupFilterChange: (val: string) => void;
  onToolFilterChange: (val: string) => void;
  onLangFilterChange: (val: string) => void;
  onSearchChange: (val: string) => void;
  semanticsViewMode: SemanticsViewMode;
  onViewModeChange: (mode: SemanticsViewMode) => void;
  jsonViewColors: JsonViewColors;
  onJsonViewColorsChange?: (colors: JsonViewColors) => void;
  pendingSemanticDraft?: PendingSemanticDraft | null;
  title?: string;
  subtitle?: string;
  top?: React.ReactNode;
  showToolGroupFilter?: boolean;
  showToolFilter?: boolean;
  showLangFilter?: boolean;
  showBulkAdd?: boolean;
  showClearAll?: boolean;
  showDeleteBatch?: boolean;
  showRowSelection?: boolean;
  responsiveCards?: boolean;
}

export function SemanticsEditor({
  phrases,
  loading,
  onSave,
  onDelete,
  onClearAll,
  onDeleteBatch,
  onReindexAll,
  onExport,
  onImport,
  onImportFiles,
  onPollImportJob,
  onImportComplete,
  availableTools = [],
  toolGroups = [],
  toolGroupByName = {},
  allowedLangs,
  toolGroupFilter,
  toolFilter,
  langFilter,
  searchQuery,
  langGroups,
  totalPhrases,
  pagination,
  onPaginationChange,
  pageCount,
  rowCount,
  rowSelection,
  onRowSelectionChange,
  onToolGroupFilterChange,
  onToolFilterChange,
  onLangFilterChange,
  onSearchChange,
  semanticsViewMode,
  onViewModeChange,
  jsonViewColors,
  onJsonViewColorsChange,
  pendingSemanticDraft,
  title = 'Semantic Phrases',
  subtitle,
  top,
  showToolGroupFilter = true,
  showToolFilter = true,
  showLangFilter = true,
  showBulkAdd = true,
  showClearAll = true,
  showDeleteBatch = true,
  showRowSelection = true,
  responsiveCards = true,
}: SemanticsEditorProps) {
  const safePhrases = Array.isArray(phrases) ? phrases : [];
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const multiFileInputRef = useRef<HTMLInputElement | null>(null);

  const langOptions = allowedLangs && allowedLangs.length > 0
    ? ALL_LANG_OPTIONS.filter((o) => allowedLangs.includes(o.value))
    : ALL_LANG_OPTIONS;
  const defaultLang = (langOptions[0]?.value ?? 'en') as string;

  const { form, createMode, editingId, setCreateMode, setEditingId, setForm, startCreate, startEdit, cancelEdit } = useSemanticsEditorState({
    defaultLang,
    initialToolName: toolFilter,
    initialLang: langFilter,
  });

  useEffect(() => {
    if (!pendingSemanticDraft) return;
    startCreate(pendingSemanticDraft.toolName, defaultLang);
    setForm({ phrase: pendingSemanticDraft.phrase });
  }, [pendingSemanticDraft]);

  const { importJob, setImportJob, transferring, setTransferring, banner, setBanner } = useSemanticsImportJob(onPollImportJob, onImportComplete);

  const [reindexing, setReindexing] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [deleteSelectedDialogOpen, setDeleteSelectedDialogOpen] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);

  const selectedIds = useMemo<string[]>(
    () => Object.keys(rowSelection).filter((id) => rowSelection[id]),
    [rowSelection]
  );
  const selectedCount = selectedIds.length;

  const pendingCount = getPendingCount(safePhrases);
  const hasSemanticsData = totalPhrases > 0 || safePhrases.length > 0;
  const hasActiveFilters = !!(searchQuery || toolFilter || toolGroupFilter || langFilter);
  const hasEditorContent = !!banner || createMode !== null || !!editingId;
  const importJobActive = !!importJob && (importJob.status === 'running' || importJob.status === 'queued');

  const { langGroupOptions, toolGroupOptions } = useSemanticsFilters(langGroups, toolGroups);

  const scopedAvailableTools = useMemo(
    () => toolGroupFilter
      ? availableTools.filter((t) => toolGroupByName[t] === toolGroupFilter)
      : availableTools,
    [availableTools, toolGroupByName, toolGroupFilter]
  );

  const viewCtx = useContextMenu();
  const openViewModeMenu = useCallback((e: React.MouseEvent) => {
    if (e.defaultPrevented) return;
    e.preventDefault();
    viewCtx.open(e, [
      { label: semanticsViewMode === 'table' ? '✓ Table' : 'Table', icon: TableIcon, onSelect: () => onViewModeChange('table') },
      { label: semanticsViewMode === 'json' ? '✓ JSON' : 'JSON', icon: Code2, onSelect: () => onViewModeChange('json') },
      { label: semanticsViewMode === 'files' ? '✓ Files' : 'Files', icon: FolderOpen, onSelect: () => onViewModeChange('files') },
    ]);
  }, [viewCtx, semanticsViewMode, onViewModeChange]);

  const handleSave = async () => {
    try {
      const result = await onSave({ id: editingId ?? undefined, phrase: form.phrase, toolName: form.toolName, lang: form.lang });
      cancelEdit();
      if (result?.embeddingError) {
        setBanner({ kind: 'warning', message: `Saved as PENDING — embedding failed: ${result.embeddingError}. Click "Reindex All" once the embedding service is reachable.` });
      } else if (result && !result.hasEmbedding) {
        setBanner({ kind: 'warning', message: 'Saved without embedding — click "Reindex All" to retry.' });
      } else { setBanner(null); }
    } catch (err) {
      setBanner({ kind: 'error', message: err instanceof Error ? err.message : 'Failed to save semantic phrase' });
    }
  };

  const handleReindex = async () => {
    if (!onReindexAll) return;
    setReindexing(true);
    setBanner(null);
    try {
      await onReindexAll();
      setBanner({ kind: 'info', message: 'Reindex complete.' });
    } catch (err) {
      setBanner({ kind: 'error', message: err instanceof Error ? err.message : 'Reindex failed' });
    } finally { setReindexing(false); }
  };

  const handleDeleteSelected = async () => {
    if (!onDeleteBatch || selectedIds.length === 0) return;
    setDeletingSelected(true);
    setBanner(null);
    try {
      const result = await onDeleteBatch(selectedIds);
      onRowSelectionChange({});
      setDeleteSelectedDialogOpen(false);
      setBanner({ kind: 'info', message: `Deleted ${result.deleted} semantic phrase${result.deleted === 1 ? '' : 's'}.` });
    } catch (err) {
      setBanner({ kind: 'error', message: err instanceof Error ? err.message : 'Failed to delete selection.' });
    } finally {
      setDeletingSelected(false);
    }
  };

  const handleClearAll = async () => {
    if (!onClearAll) return;
    setTransferring(true);
    setBanner(null);
    try {
      const result = await onClearAll();
      const cleared = result as { deleted: number } | null;
      const deleted = cleared?.deleted ?? totalPhrases;
      setBanner({ kind: 'info', message: `Cleared ${deleted} semantic phrase${deleted === 1 ? '' : 's'}.` });
      setClearDialogOpen(false);
    } catch (err) {
      setBanner({ kind: 'error', message: err instanceof Error ? err.message : 'Failed to clear semantics' });
    } finally { setTransferring(false); }
  };

  const handleExport = async () => {
    if (!onExport) return;
    setTransferring(true);
    setBanner(null);
    try {
      const payload = await onExport();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = 'semantics_export.json';
      document.body.appendChild(link); link.click(); link.remove();
      URL.revokeObjectURL(url);
      setBanner({ kind: 'info', message: 'Exported semantics JSON.' });
    } catch (err) {
      setBanner({ kind: 'error', message: err instanceof Error ? err.message : 'Export failed' });
    } finally { setTransferring(false); }
  };

  const handleLegacyImportFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!onImport) return;
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setTransferring(true);
    setBanner(null);
    try {
      const raw = await file.text();
      const payload = JSON.parse(raw) as SemanticsExportPayload;
      if (!isValidSemanticsPayload(payload)) throw new Error('Invalid semantics JSON. Expected grouped tool/language arrays or { "items": [...] }.');
      const result = await onImport(payload);
      const inserted = result.results.filter((r) => r.status === 'inserted').length;
      const updated = result.results.filter((r) => r.status === 'updated').length;
      const skipped = result.results.filter((r) => r.status === 'skipped').length;
      setBanner({ kind: skipped > 0 ? 'warning' : 'info', message: `Import complete: ${inserted} inserted, ${updated} updated, ${skipped} skipped.` });
    } catch (err) {
      setBanner({ kind: 'error', message: err instanceof Error ? err.message : 'Import failed' });
    } finally { setTransferring(false); }
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    if (!onImportFiles) return;
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;
    setTransferring(true);
    setBanner(null);
    try {
      const job = await onImportFiles(files);
      setImportJob(job);
      setBanner(null);
    } catch (err) {
      setBanner({ kind: 'error', message: err instanceof Error ? err.message : 'Import failed' });
      setTransferring(false);
    }
  };

  const columns = useMemo(
    () => buildSemanticColumns({ toolGroupByName, onEdit: startEdit, onDelete }),
    [toolGroupByName, startEdit, onDelete]
  );

  const SemanticCard = useMemo(
    () => makeSemanticCard({ toolGroupByName, onEdit: startEdit, onDelete }),
    [toolGroupByName, startEdit, onDelete]
  );

  const table = (
    <div className="flex flex-col h-full min-h-0" onContextMenu={openViewModeMenu}>
    {viewCtx.menu}
    <NTable<SemanticPhraseResponse, 'table' | 'json' | 'files'>
      data={safePhrases}
      columns={columns}
      getRowId={(p) => p.id}
      availableModes={['table', 'json', 'files'] as const}
      mode={semanticsViewMode}
      onModeChange={onViewModeChange}
      manualPagination
      pagination={pagination}
      onPaginationChange={onPaginationChange}
      pageCount={pageCount}
      rowCount={rowCount}
      rowSelection={rowSelection}
      onRowSelectionChange={onRowSelectionChange}
      renderCard={SemanticCard}
      responsiveCards={responsiveCards}
      showViewToggle
      showCheckbox={showRowSelection}
      renderJson={() => (
        <SemanticsJsonView
          toolGroupFilter={toolGroupFilter}
          toolFilter={toolFilter}
          langFilter={langFilter}
          searchQuery={searchQuery}
          colors={jsonViewColors}
          onColorsChange={onJsonViewColorsChange}
          onRefresh={async () => { await onImportComplete?.(); }}
        />
      )}
      renderCustomMode={{
        files: () => (
          <SemanticsFilesAdapter
            selectedGroup={toolGroupFilter || null}
            selectedFile={langFilter ? `${langFilter}.json` : null}
            onSelectedGroupChange={(group) => {
              onSearchChange('');
              onToolFilterChange('');
              onToolGroupFilterChange(group ?? '');
              onLangFilterChange('');
            }}
            onFileOpen={(group, lang) => {
              onSearchChange('');
              onToolFilterChange('');
              onToolGroupFilterChange(group);
              onLangFilterChange(lang);
              onViewModeChange('json');
            }}
          />
        ),
      }}
      headerSlot={
        semanticsViewMode === 'files'
          ? (
            <LogicalFilesBreadcrumb
              workspaceLabel="Semantics"
              rootLabel="Files"
              selectedGroup={toolGroupFilter || null}
              selectedFile={langFilter ? `${langFilter}.json` : null}
              onBackToWorkspace={() => {
                onSearchChange('');
                onToolFilterChange('');
                onToolGroupFilterChange('');
                onLangFilterChange('');
                onViewModeChange('table');
              }}
              onBackToRoot={() => {
                onSearchChange('');
                onToolFilterChange('');
                onToolGroupFilterChange('');
                onLangFilterChange('');
              }}
              onOpenGroup={(group) => {
                onSearchChange('');
                onToolFilterChange('');
                onToolGroupFilterChange(group);
                onLangFilterChange('');
              }}
            />
          )
          : undefined
      }
      loading={loading && safePhrases.length === 0}
      isEmpty={semanticsViewMode !== 'json' && semanticsViewMode !== 'files' && safePhrases.length === 0 && !hasActiveFilters}
      isFilteredEmpty={semanticsViewMode !== 'json' && semanticsViewMode !== 'files' && safePhrases.length === 0 && hasActiveFilters}
      renderEmpty={() => (
        <NEmptyState
          icon={Tag}
          title="No semantic phrases yet"
          description="Add a phrase to start mapping it to a tool."
        />
      )}
      renderFilteredEmpty={() => (
        <NEmptyState
          icon={Tag}
          title="No phrases match your filters"
          description="Filters are server-side; try adjusting them to find results."
        />
      )}
      renderToolbar={
        semanticsViewMode !== 'files' && (hasSemanticsData || hasActiveFilters)
          ? () => (
              <SemanticFilters
                searchQuery={searchQuery}
                toolGroupFilter={toolGroupFilter}
                toolFilter={toolFilter}
                langFilter={langFilter}
                toolGroupOptions={toolGroupOptions}
                availableTools={scopedAvailableTools}
                langGroupOptions={langGroupOptions}
                showToolGroupFilter={showToolGroupFilter}
                showToolFilter={showToolFilter}
                showLangFilter={showLangFilter}
                onSearchChange={onSearchChange}
                onToolGroupFilterChange={onToolGroupFilterChange}
                onToolFilterChange={onToolFilterChange}
                onLangFilterChange={onLangFilterChange}
              />
            )
          : undefined
      }
      classNames={hasEditorContent ? { content: 'pt-0' } : undefined}
    />
    </div>
  );
  const panelTop = top || importJobActive ? (
    <>
      {top}
      {importJobActive && <ImportJobProgress job={importJob} />}
    </>
  ) : undefined;

  return (
    <>
      <NPageHeader
        icon={Tag}
        title={title}
        subtitle={subtitle ?? `${totalPhrases} phrase${totalPhrases !== 1 ? 's' : ''} total${pendingCount > 0 ? ` · ${pendingCount} pending` : ''}`}
        actions={
          semanticsViewMode === 'files'
            ? undefined
            : (
              <SemanticsToolbar
                totalPhrases={totalPhrases}
                pendingCount={pendingCount}
                selectedCount={selectedCount}
                transferring={transferring}
                reindexing={reindexing}
                deletingSelected={deletingSelected}
                clearing={false}
                createMode={createMode}
                hasImportFiles={!!onImportFiles}
                hasImport={!!onImport}
                hasExport={!!onExport}
                hasDeleteBatch={showDeleteBatch && !!onDeleteBatch}
                hasClearAll={showClearAll && !!onClearAll}
                hasReindexAll={!!onReindexAll}
                onImportClick={() => onImportFiles ? multiFileInputRef.current?.click() : fileInputRef.current?.click()}
                onExportClick={handleExport}
                onDeleteSelectedClick={() => setDeleteSelectedDialogOpen(true)}
                onClearAllClick={() => setClearDialogOpen(true)}
                onReindexClick={handleReindex}
                onAddSingle={() => startCreate(toolFilter || '', langFilter || defaultLang)}
                onAddBulk={() => setCreateMode('bulk')}
                onClose={cancelEdit}
                showBulkAdd={showBulkAdd}
              />
            )
        }
        top={panelTop}
        contentClassName={semanticsViewMode === 'json' ? 'flex-1 flex flex-col overflow-hidden' : 'flex-1 overflow-auto'}
      >
        <DeleteSelectedDialog
          open={deleteSelectedDialogOpen}
          count={selectedCount}
          loading={deletingSelected}
          onConfirm={handleDeleteSelected}
          onCancel={() => setDeleteSelectedDialogOpen(false)}
        />

        <ClearAllDialog
          open={clearDialogOpen}
          totalCount={totalPhrases}
          loading={transferring}
          onConfirm={handleClearAll}
          onCancel={() => setClearDialogOpen(false)}
        />
        {banner && (
          <div className="px-5 py-3 border-b border-border">
            <SemanticBanner banner={banner} onDismiss={() => setBanner(null)} />
          </div>
        )}

        <NSheet
          open={createMode === 'single' || !!editingId}
          onOpenChange={(o) => { if (!o) cancelEdit(); }}
          title={editingId ? 'Edit Semantic Phrase' : 'New Semantic Phrase'}
          description="One phrase mapped to one tool and one language."
          width={480}
        >
          <SemanticForm
            isCreating={!editingId}
            editingId={editingId}
            form={form}
            availableTools={availableTools}
            langOptions={langOptions}
            onFormChange={setForm}
            onSave={handleSave}
            onCancel={cancelEdit}
          />
        </NSheet>

        <NSheet
          open={createMode === 'bulk'}
          onOpenChange={(o) => { if (!o) setCreateMode(null); }}
          title="Bulk Add Semantic Phrases"
          description="Pick one tool, paste a language map, save them all at once."
          width={620}
        >
          <SemanticBulkForm
            availableTools={availableTools}
            allowedLangs={allowedLangs}
            onCancel={() => setCreateMode(null)}
            onSave={async (items) => {
              if (!onImport) return;
              const payload: Record<string, Record<string, string[]>> = {};
              for (const it of items) {
                payload[it.toolName] ??= {};
                payload[it.toolName][it.lang] ??= [];
                payload[it.toolName][it.lang].push(it.phrase);
              }
              try {
                await onImport(payload as any);
              } catch (err) {
                console.error('Bulk import failed:', err);
              }
              setCreateMode(null);
            }}
          />
        </NSheet>

        {table}
      </NPageHeader>

      {onImportFiles && (
        <input ref={multiFileInputRef} type="file" accept="application/json,.json" multiple className="hidden" onChange={handleFileImport} />
      )}
      {!onImportFiles && onImport && (
        <input ref={fileInputRef} type="file" accept="application/json,.json" className="hidden" onChange={handleLegacyImportFile} />
      )}
    </>
  );
}
