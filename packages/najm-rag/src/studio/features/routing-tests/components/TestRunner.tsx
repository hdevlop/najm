import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ExpandedState, RowSelectionState } from '@tanstack/react-table';
import { NTable, NPageHeader, Button, NSheet, NEmptyState, useLocalStorageState, useContextMenu, useDebouncedValue } from 'najm-ui';
import { TestTube, Loader2, Download, Play, Plus, Trash2, Upload, Table as TableIcon, Code2, FolderOpen } from 'lucide-react';
import { ImportJobProgress } from '@/features/routing-semantics/components/ImportJobProgress';
import { SemanticBanner } from '@/features/routing-semantics/components/SemanticBanner';
import { TestFilters } from './TestFilters';
import { TestCaseForm } from './TestCaseForm';
import { TestRunnerDeleteSelectedDialog, TestRunnerClearAllDialog } from './TestRunnerDialogs';
import { TestRunnerJsonView } from './TestRunnerJsonView';
import { TestsFilesAdapter } from './TestsFilesAdapter';
import { useTestFilters } from '../hooks/useTestFilters';
import { useRoutingTests } from '../hooks/useRoutingTests';
import { useTestRunnerForm } from '../hooks/useTestRunnerForm';
import { useBanner } from '@/shared/hooks/useBanner';
import { buildTestColumns } from './columns';
import { TestSubRow } from './TestSubRow';
import { makeTestCard } from './TestCard';
import type { TestCase } from '../types';
import type { JsonViewColors, TestRunnerViewMode } from '@/features/routing-tests/types';
import { LogicalFilesBreadcrumb } from '@/features/storage';

import type { PendingTestDraft } from '@/lib/chatDraftsContext';

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

interface TestRunnerProps {
  availableTools: string[];
  toolGroupByName?: Record<string, string>;
  jsonViewColors: JsonViewColors;
  pendingDraft?: PendingTestDraft | null;
  title?: string;
  subtitle?: string;
  top?: React.ReactNode;
  initialPageSize?: number;
  fileFilter?: {
    group: string;
    lang?: string;
    toolGroupByName: Record<string, string>;
  };
  showToolFilter?: boolean;
  showStatusFilter?: boolean;
  showClearAll?: boolean;
  showDeleteBatch?: boolean;
  showRowSelection?: boolean;
  showRunPage?: boolean;
  responsiveCards?: boolean;
  resetNonce?: number;
  initialView?: 'table' | 'json' | 'files';
  initialGroup?: string;
  initialLang?: string;
  onSearchStateChange?: (state: { view?: string; group?: string; lang?: string }) => void;
}

const STATUS_OPTIONS = [
  { value: '', label: 'All results' },
  { value: 'pending', label: 'Pending' },
  { value: 'pass', label: 'Passed' },
  { value: 'fail', label: 'Failed' },
  { value: 'low_confidence', label: 'Low confidence' },
];

export function TestRunner({
  availableTools,
  toolGroupByName = {},
  jsonViewColors,
  pendingDraft,
  title = 'Test Runner',
  subtitle,
  top,
  initialPageSize,
  fileFilter,
  showToolFilter = true,
  showStatusFilter = true,
  showClearAll = true,
  showDeleteBatch = true,
  showRowSelection = true,
  showRunPage = true,
  responsiveCards = true,
  resetNonce,
  initialView,
  initialGroup,
  initialLang,
  onSearchStateChange,
}: TestRunnerProps) {
  const {
    tests,
    results,
    total,
    loading,
    runningId,
    runningAll,
    importJob,
    pagination,
    setPagination,
    pageCount,
    rowCount,
    rowSelection,
    setRowSelection,
    resetPagination,
    addTest,
    updateTest,
    deleteTest,
    deleteTestsBatch,
    deleteAllTests,
    runOne,
    runAll,
    importFiles,
    dismissImportJob,
    exportToFile,
    refresh,
  } = useRoutingTests({ initialPageSize });

  const [testsViewMode, setTestsViewMode] = useLocalStorageState<TestRunnerViewMode>(
    'najm-rag-studio:tests:view-mode',
    (initialView ?? getStoredFileViewMode(
      'najm-rag-studio:tests:view-mode',
      'najm-rag-studio:testsViewMode',
      'table',
    )) as TestRunnerViewMode,
  );

  const multiFileInputRef = useRef<HTMLInputElement | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [querySearch, setQuerySearch] = useState('');
  const debouncedSearchQuery = useDebouncedValue(searchQuery, 1000);
  const debouncedQuerySearch = useDebouncedValue(querySearch, 1000);
  const [statusFilter, setStatusFilter] = useState('');
  const [toolFilter, setToolFilter] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [fileScope, setFileScope] = useState<{
    group: string;
    lang?: string;
  } | null>(() => initialGroup ? { group: initialGroup, lang: initialLang } : null);

  const { banner, showBanner, dismissBanner } = useBanner();
  const viewCtx = useContextMenu();
  const openViewModeMenu = useCallback((e: React.MouseEvent) => {
    if (e.defaultPrevented) return;
    e.preventDefault();
    viewCtx.open(e, [
      { label: testsViewMode === 'table' ? '✓ Table' : 'Table', icon: TableIcon, onSelect: () => setTestsViewMode('table') },
      { label: testsViewMode === 'json' ? '✓ JSON' : 'JSON', icon: Code2, onSelect: () => setTestsViewMode('json') },
      { label: testsViewMode === 'files' ? '✓ Files' : 'Files', icon: FolderOpen, onSelect: () => setTestsViewMode('files') },
    ]);
  }, [viewCtx, testsViewMode, setTestsViewMode]);

  const effectiveFileFilter = fileFilter || (fileScope?.group
    ? { group: fileScope.group, lang: fileScope.lang, toolGroupByName }
    : null);

  useEffect(() => {
    onSearchStateChange?.({
      view: testsViewMode,
      group: fileScope?.group,
      lang: fileScope?.lang,
    });
  }, [testsViewMode, fileScope, onSearchStateChange]);

  useEffect(() => {
    if (!resetNonce) return;
    setSearchQuery('');
    setQuerySearch('');
    setToolFilter('');
    setStatusFilter('');
    setFileScope(null);
  }, [resetNonce]);

  const handleTestsViewModeChange = useCallback((mode: TestRunnerViewMode) => {
    setTestsViewMode(mode);
  }, [setTestsViewMode]);

  const fileFilteredTests = useMemo(() => {
    if (!effectiveFileFilter) return tests;
    return tests.filter((test) => {
      const firstTool = test.expectedTools[0];
      const group = (firstTool && effectiveFileFilter.toolGroupByName[firstTool]) || 'uncategorized';
      if (group !== effectiveFileFilter.group) return false;
      if (!effectiveFileFilter.lang) return true;
      const lang = (test.lang && test.lang.trim()) || 'und';
      return lang === effectiveFileFilter.lang;
    });
  }, [effectiveFileFilter, tests]);

  const fileFilteredResults = useMemo(() => {
    if (!effectiveFileFilter) return results;
    const allowedIds = new Set(fileFilteredTests.map((test) => test.id));
    return Object.fromEntries(Object.entries(results).filter(([id]) => allowedIds.has(id)));
  }, [effectiveFileFilter, fileFilteredTests, results]);

  useEffect(() => {
    if (!importJob) return;
    if (importJob.status === 'completed') {
      setTransferring(false);
      showBanner(
        importJob.failed > 0 ? 'warning' : 'info',
        `Imported ${importJob.inserted} routing test${importJob.inserted === 1 ? '' : 's'}${importJob.failed > 0 ? ` · ${importJob.failed} failed` : ''}.`
      );
      dismissImportJob();
    } else if (importJob.status === 'failed') {
      setTransferring(false);
      showBanner('error', importJob.errors.length > 0 ? `Import failed: ${importJob.errors.join('; ')}` : 'Import failed.');
      dismissImportJob();
    }
  }, [importJob]);

  // Page-local filters (Option A). resetPagination is called when filter inputs change so
  // the user always sees results from the first page after editing a filter.
  const { filteredTests } = useTestFilters({
    tests: fileFilteredTests,
    results: fileFilteredResults,
    searchQuery: debouncedSearchQuery,
    querySearch: debouncedQuerySearch,
    toolFilter,
    statusFilter,
  });

  const filtersKey = `${debouncedSearchQuery}|${debouncedQuerySearch}|${toolFilter}|${statusFilter}`;
  const isFirstFilterRunRef = useRef(true);
  useEffect(() => {
    if (isFirstFilterRunRef.current) {
      isFirstFilterRunRef.current = false;
      return;
    }
    // Reset to page 0 on any filter signature change, including clearing all filters.
    resetPagination();
  }, [filtersKey, resetPagination]);

  const {
    form,
    editingId,
    showForm,
    formExpectedTools,
    setForm,
    setEditingId,
    setShowForm,
    resetForm,
    openAddForm,
    editTest,
    addExpectedTool,
    removeExpectedTool,
  } = useTestRunnerForm();

  useEffect(() => {
    if (!pendingDraft) return;
    openAddForm();
    setForm('name', pendingDraft.query.slice(0, 60));
    setForm('query', pendingDraft.query);
    for (const tool of pendingDraft.expectedTools) {
      addExpectedTool(tool);
    }
  }, [pendingDraft]);

  const handleOpenAddForm = useCallback(() => {
    openAddForm();
    if (effectiveFileFilter?.lang) setForm('lang', effectiveFileFilter.lang);
  }, [effectiveFileFilter, openAddForm, setForm]);

  const [saving, setSaving] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearDialogOpen, setClearDialogOpen] = useState(false);
  const [deleteSelectedDialogOpen, setDeleteSelectedDialogOpen] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);
  const [transferring, setTransferring] = useState(false);

  const selectedIds = useMemo<string[]>(
    () => Object.keys(rowSelection).filter((id) => rowSelection[id]),
    [rowSelection]
  );
  const selectedCount = selectedIds.length;

  const handleRowSelectionChange = useCallback((next: RowSelectionState) => {
    setRowSelection(next);
  }, [setRowSelection]);

  const handlePaginationChange = useCallback(
    (next: { pageIndex: number; pageSize: number }) => setPagination(next),
    [setPagination],
  );

  // Controlled expansion: keep at most one row expanded at a time.
  const controlledExpanded: ExpandedState = expandedId ? { [expandedId]: true } : {};
  const handleExpandedChange = useCallback((next: ExpandedState) => {
    if (next === true) { setExpandedId(null); return; }
    const truthyKeys = Object.keys(next).filter((k) => (next as Record<string, boolean>)[k]);
    if (truthyKeys.length === 0) { setExpandedId(null); return; }
    const newKey = truthyKeys.find((k) => k !== expandedId);
    if (newKey) setExpandedId(newKey);
    else setExpandedId(null);
  }, [expandedId]);

  const saveTest = async () => {
    const expectedTools = [...new Set([...formExpectedTools])];
    if (!form.name.trim() || !form.query.trim() || expectedTools.length === 0) return;
    setSaving(true);
    try {
      if (editingId) {
        const updated = await updateTest(editingId, {
          name: form.name.trim(),
          query: form.query.trim(),
          lang: form.lang.trim() || 'und',
          expectedTools,
        });
        setExpandedId(updated.id);
      } else {
        const created = await addTest({
          name: form.name.trim(),
          query: form.query.trim(),
          lang: form.lang.trim() || 'und',
          expectedTools,
        });
        setExpandedId(created.id);
      }
      resetForm();
    } catch (err) {
      console.error('Failed to save routing test:', err);
    } finally {
      setSaving(false);
    }
  };

  const deleteTestById = useCallback(async (id: string) => {
    try {
      await deleteTest(id);
      if (expandedId === id) setExpandedId(null);
    } catch (err) {
      console.error('Failed to delete routing test:', err);
    }
  }, [deleteTest, expandedId]);

  const handleRunSingle = useCallback(async (id: string) => {
    try {
      await runOne(id);
      setExpandedId(id);
    } catch (err) {
      console.error('Failed to run routing test:', err);
    }
  }, [runOne]);

  const handleRunAll = async () => {
    try {
      if (effectiveFileFilter) {
        for (const test of filteredTests) await runOne(test.id);
      } else {
        await runAll();
      }
      setExpandedId((prev) => prev ?? null);
    } catch (err) {
      console.error('Failed to run routing tests:', err);
    }
  };

  const handleFileImport = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    event.target.value = '';
    if (files.length === 0) return;
    dismissBanner();
    setTransferring(true);
    try {
      await importFiles(files);
    } catch (err) {
      setTransferring(false);
      showBanner('error', err instanceof Error ? err.message : 'Import failed.');
    }
  };

  const handleDeleteSelected = async () => {
    if (selectedIds.length === 0) return;
    setDeletingSelected(true);
    try {
      const result = await deleteTestsBatch(selectedIds);
      setRowSelection({});
      setDeleteSelectedDialogOpen(false);
      showBanner('info', `Deleted ${result.deleted} routing test${result.deleted === 1 ? '' : 's'}.`);
      if (expandedId && selectedIds.includes(expandedId)) setExpandedId(null);
    } catch (err) {
      showBanner('error', err instanceof Error ? err.message : 'Failed to delete selection.');
    } finally {
      setDeletingSelected(false);
    }
  };

  const handleClearAll = async () => {
    setClearing(true);
    try {
      await deleteAllTests();
      setExpandedId(null);
      setRowSelection({});
      setClearDialogOpen(false);
    } catch (err) {
      console.error('Failed to clear routing tests:', err);
    } finally {
      setClearing(false);
    }
  };

  const handleExport = () => {
    exportToFile().catch((err) => {
      console.error('Failed to export tests:', err);
    });
  };

  const canSave = !!form.name.trim() && !!form.query.trim() && formExpectedTools.length > 0 && !saving;

  const visibleTotal = effectiveFileFilter ? fileFilteredTests.length : total;
  const scopedAvailableTools = useMemo(() => {
    if (!effectiveFileFilter) return availableTools;
    const used = new Set<string>();
    for (const test of fileFilteredTests) {
      for (const tool of test.expectedTools) used.add(tool);
    }
    return availableTools.filter((tool) => used.has(tool));
  }, [effectiveFileFilter, fileFilteredTests, availableTools]);
  const passed = Object.values(fileFilteredResults).filter((r) => r.status === 'pass').length;
  const failed = Object.values(fileFilteredResults).filter((r) => r.status === 'fail').length;
  const lowConfidence = Object.values(fileFilteredResults).filter((r) => r.status === 'low_confidence').length;
  const hasTests = visibleTotal > 0 || fileFilteredTests.length > 0;
  const hasActiveFilters = !!(searchQuery || querySearch || toolFilter || statusFilter);

  const columns = useMemo(
    () =>
      buildTestColumns({
        results: fileFilteredResults,
        runningId,
        onRun: (test) => handleRunSingle(test.id),
        onEdit: (test) => editTest(test),
        onDelete: (test) => deleteTestById(test.id),
      }),
    [fileFilteredResults, runningId, handleRunSingle, editTest, deleteTestById]
  );

  const TestCard = useMemo(
    () =>
      makeTestCard({
        results: fileFilteredResults,
        runningId,
        onRun: (test) => handleRunSingle(test.id),
        onEdit: (test) => editTest(test),
        onDelete: (test) => deleteTestById(test.id),
      }),
    [fileFilteredResults, runningId, handleRunSingle, editTest, deleteTestById]
  );

  const subtitleBase = loading
    ? 'Loading…'
    : `${visibleTotal} test${visibleTotal !== 1 ? 's' : ''} defined`;
  const subtitleScope = effectiveFileFilter
    ? `${effectiveFileFilter.group}${effectiveFileFilter.lang ? ` / ${effectiveFileFilter.lang}.json` : ''} · `
    : '';
  const subtitleResults = passed + failed + lowConfidence > 0
    ? ` · ${passed} passed · ${failed + lowConfidence} failed`
    : '';
  const subtitleFilter = hasActiveFilters
    ? ` · ${filteredTests.length} of ${fileFilteredTests.length}${effectiveFileFilter ? '' : ' on this page'}`
    : '';
  const computedSubtitle = subtitleScope + subtitleBase + subtitleResults + subtitleFilter;
  const importJobActive = !!importJob;
  const panelTop = top || importJobActive ? (
    <>
      {top}
      {importJobActive && <ImportJobProgress job={importJob} />}
    </>
  ) : undefined;

  return (
    <NPageHeader
      icon={TestTube}
      title={title}
      subtitle={subtitle ?? computedSubtitle}
      contentClassName={testsViewMode === 'json' ? 'flex-1 flex flex-col overflow-hidden' : 'flex-1 overflow-auto'}
      top={panelTop}
      actions={
        testsViewMode === 'files'
          ? undefined
          : (
            <>
              {showDeleteBatch && selectedCount > 0 && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setDeleteSelectedDialogOpen(true)}
                  disabled={deletingSelected || runningAll}
                  className="gap-1.5 border-status-red/40 px-2 text-status-red hover:bg-status-red/10 hover:text-status-red"
                >
                  {deletingSelected ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">Delete ({selectedCount})</span>
                </Button>
              )}
              {showClearAll && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setClearDialogOpen(true)}
                  disabled={tests.length === 0 || runningAll || clearing}
                  className="gap-1.5 border-status-red/40 px-2 text-status-red hover:bg-status-red/10 hover:text-status-red"
                >
                  {clearing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">Clear</span>
                </Button>
              )}
              <Button variant="outline" onClick={handleExport} disabled={filteredTests.length === 0} className="gap-1.5 px-2">
                <Download className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Export Visible</span>
              </Button>
              <input
                ref={multiFileInputRef}
                type="file"
                accept="application/json,.json"
                multiple
                className="hidden"
                onChange={handleFileImport}
              />
              <Button
                size="sm"
                variant="outline"
                onClick={() => multiFileInputRef.current?.click()}
                disabled={transferring}
                className="gap-1.5 px-2"
              >
                {transferring ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                <span className="hidden sm:inline">Import</span>
              </Button>
              <Button onClick={handleOpenAddForm} disabled={showForm} className="gap-1.5 border border-border bg-card px-2 text-foreground shadow-sm hover:bg-accent hover:text-foreground">
                <Plus className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Add Test</span>
              </Button>
              {showRunPage && (
                <Button onClick={handleRunAll} disabled={runningAll || filteredTests.length === 0} className="gap-1.5 border border-border bg-card px-2 text-foreground shadow-sm hover:bg-accent hover:text-foreground" title={effectiveFileFilter ? 'Run visible tests' : 'Run all tests on the current page'}>
                  {runningAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                  <span className="hidden sm:inline">{effectiveFileFilter ? 'Run Visible' : 'Run Page'}</span>
                </Button>
              )}
            </>
          )
      }
    >
      <TestRunnerDeleteSelectedDialog
        open={deleteSelectedDialogOpen}
        count={selectedCount}
        loading={deletingSelected}
        onConfirm={handleDeleteSelected}
        onCancel={() => setDeleteSelectedDialogOpen(false)}
      />

      <TestRunnerClearAllDialog
        open={clearDialogOpen}
        testCount={tests.length}
        loading={clearing}
        onConfirm={handleClearAll}
        onCancel={() => setClearDialogOpen(false)}
      />

      {banner && (
        <div className="px-5 py-3 border-b border-border">
          <SemanticBanner banner={banner} onDismiss={dismissBanner} />
        </div>
      )}

      <NSheet
        open={showForm}
        onOpenChange={(o) => { if (!o) resetForm(); }}
        title={editingId ? 'Edit Test Case' : 'New Test Case'}
        description="Define the query and expected tools."
        width={480}
      >
          <TestCaseForm
            availableTools={availableTools}
            form={form}
            formExpectedTools={formExpectedTools}
            editingId={editingId}
            onFormChange={setForm}
            onAddExpectedTool={() => addExpectedTool(form.expectedTool)}
            onRemoveExpectedTool={removeExpectedTool}
            onSave={saveTest}
            onCancel={resetForm}
            canSave={canSave}
          />
      </NSheet>

      <div className="flex flex-col h-full min-h-0" onContextMenu={openViewModeMenu}>
      <NTable<TestCase, 'table' | 'json' | 'files'>
        data={filteredTests}
        columns={columns}
        getRowId={(t) => t.id}
        availableModes={['table', 'json', 'files'] as const}
        mode={testsViewMode}
        onModeChange={handleTestsViewModeChange}
        manualPagination={!effectiveFileFilter}
        pagination={effectiveFileFilter ? undefined : pagination}
        onPaginationChange={effectiveFileFilter ? undefined : handlePaginationChange}
        pageCount={effectiveFileFilter ? undefined : pageCount}
        rowCount={effectiveFileFilter ? undefined : rowCount}
        rowSelection={rowSelection}
        onRowSelectionChange={handleRowSelectionChange}
        expanded={controlledExpanded}
        onExpandedChange={handleExpandedChange}
        getRowCanExpand={(test) => Boolean(fileFilteredResults[test.id])}
        renderSubRow={(test) => <TestSubRow test={test} result={fileFilteredResults[test.id] ?? null} />}
        renderCard={TestCard}
        responsiveCards={responsiveCards}
        showCheckbox={showRowSelection}
        renderJson={() => (
          <TestRunnerJsonView
            rows={fileFilteredTests}
            filteredRows={filteredTests}
            results={fileFilteredResults}
            loadingAll={loading}
            colors={jsonViewColors}
            onRefresh={refresh}
            runningAll={runningAll}
          />
        )}
        renderCustomMode={{
          files: () => (
            <TestsFilesAdapter
              selectedGroup={fileScope?.group ?? null}
              selectedFile={fileScope?.lang ? `${fileScope.lang}.json` : null}
              onSelectedGroupChange={(group) => {
                setSearchQuery('');
                setQuerySearch('');
                setToolFilter('');
                setStatusFilter('');
                setFileScope(group ? { group } : null);
              }}
              onFileOpen={(group, lang) => {
                setSearchQuery('');
                setQuerySearch('');
                setToolFilter('');
                setStatusFilter('');
                setFileScope({ group, lang });
                setTestsViewMode('json');
              }}
            />
          ),
        }}
        headerSlot={
          testsViewMode === 'files'
            ? (
              <LogicalFilesBreadcrumb
                workspaceLabel="Test Runner"
                rootLabel="Files"
                selectedGroup={fileScope?.group ?? null}
                selectedFile={fileScope?.lang ? `${fileScope.lang}.json` : null}
                onBackToWorkspace={() => {
                  setSearchQuery('');
                  setQuerySearch('');
                  setToolFilter('');
                  setStatusFilter('');
                  setFileScope(null);
                  setTestsViewMode('table');
                }}
                onBackToRoot={() => {
                  setSearchQuery('');
                  setQuerySearch('');
                  setToolFilter('');
                  setStatusFilter('');
                  setFileScope(null);
                }}
                onOpenGroup={(group) => {
                  setSearchQuery('');
                  setQuerySearch('');
                  setToolFilter('');
                  setStatusFilter('');
                  setFileScope({ group });
                }}
              />
            )
            : undefined
        }
        loading={loading && !hasTests}
        isEmpty={testsViewMode !== 'json' && testsViewMode !== 'files' && !hasTests}
        isFilteredEmpty={testsViewMode !== 'json' && testsViewMode !== 'files' && hasTests && filteredTests.length === 0}
        renderEmpty={() => (
          <NEmptyState
            icon={TestTube}
            title="No routing tests defined"
            description="Add a test case to validate expected tool routing."
          />
        )}
        renderFilteredEmpty={() => (
          <NEmptyState
            icon={TestTube}
            title="No tests match your filters"
            description="Filters apply to the current page only — try adjusting your search or paging to find a different result set."
          />
        )}
        renderToolbar={
          hasTests && testsViewMode !== 'files'
            ? () => (
                <TestFilters
                  searchQuery={searchQuery}
                  onSearchQueryChange={setSearchQuery}
                  querySearch={querySearch}
                  onQuerySearchChange={setQuerySearch}
                  toolFilter={toolFilter}
                  onToolFilterChange={setToolFilter}
                  statusFilter={statusFilter}
                  onStatusFilterChange={setStatusFilter}
                  availableTools={scopedAvailableTools}
                  statusOptions={STATUS_OPTIONS}
                  showToolFilter={showToolFilter}
                  showStatusFilter={showStatusFilter}
                />
              )
            : undefined
        }
        showViewToggle
      />
      {viewCtx.menu}
      </div>
    </NPageHeader>
  );
}
