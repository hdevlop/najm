import React, { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpDown, CheckSquare, Download, Eye, FilePlus, FolderInput, LayoutGrid, List, Loader2, Pencil, Play, PlayCircle, Plus, Square, TestTube, Trash2 } from 'lucide-react';
import { Button, NFileBrowser, NPageHeader, NBulkActionsBar, NSheet, useContextMenu, useLocalStorageState, type NBulkAction, type ContextMenuItem, type FileNode, type FileBrowserMode, type NFileBrowserCardProps } from 'najm-ui';
import { TestFilters } from '@/features/routing-tests/components/TestFilters';
import { TestCaseForm } from '@/features/routing-tests/components/TestCaseForm';
import { useTestRunnerForm } from '@/features/routing-tests/hooks/useTestRunnerForm';
import { useApiClient } from '@/lib/api';
import type { MCPTool } from '@/features/logs/types';
import { ALL_LANG_OPTIONS } from '@/features/routing-semantics/constants';
import { FolderCard } from './FolderCard';
import { Breadcrumb } from './Breadcrumb';
import { TestFileView } from './TestFileView';
import type { TestFileRow } from '../types';
import { TestsFileTable } from './TestsFileTable';
import { RenameValueSheet } from './RenameValueSheet';
import { RemoveValueSheet } from './RemoveValueSheet';

interface TestsResponse {
  items: TestFileRow[];
  total: number;
}

const UNCATEGORIZED = 'uncategorized';
const UNKNOWN_LANG = 'und';
type FolderSort = 'name-asc' | 'name-desc' | 'count-desc';
type RenameTarget = { type: 'lang'; lang: string } | { type: 'test'; test: TestFileRow };

interface EmptyTestFile {
  group: string;
  lang: string;
  createdAt: string;
}

const EMPTY_TEST_FILES_KEY = 'najm-rag-studio:storage:empty-test-files';
const normalizeLangFileName = (value: string) =>
  value.trim().replace(/\.json$/i, '').trim();

export function TestsBucket() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [emptyFiles, setEmptyFiles] = useLocalStorageState<EmptyTestFile[]>(EMPTY_TEST_FILES_KEY, []);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectedLang, setSelectedLang] = useState<string | null>(null);
  const [selectedTestId, setSelectedTestId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [runAllProgress, setRunAllProgress] = useState<{ done: number; total: number } | null>(null);
  const [runningId, setRunningId] = useState<string | null>(null);
  const [searchName, setSearchName] = useState('');
  const [searchQueryText, setSearchQueryText] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [saving, setSaving] = useState(false);
  const [groupSort, setGroupSort] = useState<FolderSort>('name-asc');
  const [langSort, setLangSort] = useState<FolderSort>('name-asc');
  const [viewMode, setViewMode] = useState<FileBrowserMode>('cards');
  const [newFileTarget, setNewFileTarget] = useState<{ group: string; initialLang: string } | null>(null);
  const [newFileError, setNewFileError] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<RenameTarget | null>(null);
  const [renameBusy, setRenameBusy] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [removeLangTarget, setRemoveLangTarget] = useState<{ group: string; lang: string } | null>(null);
  const [removeLangBusy, setRemoveLangBusy] = useState(false);
  const [removeLangError, setRemoveLangError] = useState<string | null>(null);

  const switchViewItem = (): ContextMenuItem => {
    const next: FileBrowserMode = viewMode === 'cards' ? 'table' : 'cards';
    return {
      label: next === 'cards' ? 'Show as cards' : 'Show as list',
      icon: next === 'cards' ? LayoutGrid : List,
      separatorBefore: true,
      onSelect: () => setViewMode(next),
    };
  };
  const createForm = useTestRunnerForm();

  const toolsQuery = useQuery({
    queryKey: ['rag-studio', 'storage', 'tools'],
    queryFn: () => apiClient.get<MCPTool[]>('/tools/list'),
  });

  const testsQuery = useQuery({
    queryKey: ['rag-studio', 'storage', 'tests-all'],
    queryFn: () => apiClient.get<TestsResponse>('/routing-tests?limit=10000&offset=0'),
  });

  const toolGroupByName = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const tool of toolsQuery.data ?? []) map[tool.name] = tool.group || 'default';
    return map;
  }, [toolsQuery.data]);

  const availableTools = useMemo<string[]>(
    () => (toolsQuery.data ?? []).map((t) => t.name),
    [toolsQuery.data],
  );

  // group -> lang -> tests
  const byGroupLang = useMemo<Record<string, Record<string, TestFileRow[]>>>(() => {
    const out: Record<string, Record<string, TestFileRow[]>> = {};
    for (const test of testsQuery.data?.items ?? []) {
      const firstTool = test.expectedTools[0];
      const group = (firstTool && toolGroupByName[firstTool]) || UNCATEGORIZED;
      const lang = (test.lang && test.lang.trim()) || UNKNOWN_LANG;
      (out[group] ??= {});
      (out[group][lang] ??= []).push(test);
    }
    return out;
  }, [testsQuery.data, toolGroupByName]);

  const groupEntries = useMemo(
    () => {
      const entries = Object.entries(byGroupLang).map(([group, langs]) => ({
        group,
        count: Object.values(langs).reduce((sum, arr) => sum + arr.length, 0),
      }));
      if (groupSort === 'count-desc') return entries.sort((a, b) => b.count - a.count || a.group.localeCompare(b.group));
      if (groupSort === 'name-desc') return entries.sort((a, b) => b.group.localeCompare(a.group));
      return entries.sort((a, b) => a.group.localeCompare(b.group));
    },
    [byGroupLang, groupSort],
  );

  const langEntries = useMemo(() => {
    if (!selectedGroup) return [];
    const langs = byGroupLang[selectedGroup] ?? {};
    const entriesByLang = new Map(
      Object.entries(langs).map(([lang, tests]) => [lang, { lang, count: tests.length }]),
    );
    for (const file of emptyFiles) {
      if (file.group === selectedGroup && !entriesByLang.has(file.lang)) {
        entriesByLang.set(file.lang, { lang: file.lang, count: 0 });
      }
    }
    const entries = [...entriesByLang.values()];
    if (langSort === 'count-desc') return entries.sort((a, b) => b.count - a.count || a.lang.localeCompare(b.lang));
    if (langSort === 'name-desc') return entries.sort((a, b) => b.lang.localeCompare(a.lang));
    return entries.sort((a, b) => a.lang.localeCompare(b.lang));
  }, [byGroupLang, emptyFiles, selectedGroup, langSort]);

  const selectedTests = useMemo(() => {
    if (!selectedGroup || !selectedLang) return [];
    return byGroupLang[selectedGroup]?.[selectedLang] ?? [];
  }, [byGroupLang, selectedGroup, selectedLang]);

  const visibleTests = useMemo<TestFileRow[]>(() => {
    const nameQ = searchName.trim().toLowerCase();
    const queryQ = searchQueryText.trim().toLowerCase();
    return selectedTests.filter((t) => {
      if (nameQ && !t.name.toLowerCase().includes(nameQ)) return false;
      if (queryQ && !t.query.toLowerCase().includes(queryQ)) return false;
      if (statusFilter && (t.lastStatus ?? 'pending') !== statusFilter) return false;
      return true;
    });
  }, [selectedTests, searchName, searchQueryText, statusFilter]);

  const statusOptions = useMemo(() => ([
    { value: '', label: 'All results' },
    { value: 'pass', label: 'Pass' },
    { value: 'fail', label: 'Fail' },
    { value: 'low_confidence', label: 'Low confidence' },
    { value: 'pending', label: 'Pending' },
  ]), []);

  const selectedTest = selectedTestId ? selectedTests.find((t) => t.id === selectedTestId) ?? null : null;

  const ctx = useContextMenu();

  const visibleTestIds = useMemo(() => visibleTests.map((t) => t.id), [visibleTests]);
  const allVisibleSelected = visibleTestIds.length > 0 && visibleTestIds.every((id) => selectedIds.has(id));

  const openGroupMenu = (e: React.MouseEvent, group: string) => ctx.open(e, [
    { label: 'Open', icon: Eye, onSelect: () => setSelectedGroup(group) },
    {
      label: 'New file', icon: FilePlus, separatorBefore: true,
      onSelect: () => openNewFile(undefined, group),
    },
    {
      label: 'Reorganize', icon: ArrowUpDown,
      submenu: [
        { label: 'Name A-Z', onSelect: () => setGroupSort('name-asc') },
        { label: 'Name Z-A', onSelect: () => setGroupSort('name-desc') },
        { label: 'Most tests', onSelect: () => setGroupSort('count-desc') },
      ],
    },
    switchViewItem(),
  ]);

  const openLangMenu = (e: React.MouseEvent, lang: string) => ctx.open(e, [
    { label: 'Open', icon: Eye, onSelect: () => setSelectedLang(lang) },
    {
      label: 'Rename', icon: Pencil,
      onSelect: () => openRenameLangFile(lang),
    },
    {
      label: 'New file', icon: FilePlus, separatorBefore: true,
      onSelect: () => openNewFile(lang),
    },
    {
      label: 'Reorganize', icon: ArrowUpDown,
      submenu: [
        { label: 'Name A-Z', onSelect: () => setLangSort('name-asc') },
        { label: 'Name Z-A', onSelect: () => setLangSort('name-desc') },
        { label: 'Most tests', onSelect: () => setLangSort('count-desc') },
      ],
    },
    switchViewItem(),
    {
      label: 'Remove', icon: Trash2, danger: true, separatorBefore: true,
      onSelect: () => openRemoveLangFile(lang),
    },
  ]);

  const openTestMenu = (e: React.MouseEvent, test: TestFileRow) => {
    const langOptions = ALL_LANG_OPTIONS.filter((o) => o.value !== (test.lang || UNKNOWN_LANG));
    ctx.open(e, [
      { label: 'Open', icon: Eye,  onSelect: () => setSelectedTestId(test.id) },
      { label: 'Rename', icon: Pencil, onSelect: () => openRenameTest(test) },
      { label: 'Run',  icon: Play, onSelect: () => void handleRunOne(test.id) },
      {
        label: 'Move to lang', icon: FolderInput,
        submenu: langOptions.map((o): ContextMenuItem => ({
          label: `${o.label} (${o.value})`,
          onSelect: () => void handleMoveOne(test.id, o.value),
        })),
      },
      { label: 'Delete', icon: Trash2, danger: true, separatorBefore: true,
        onSelect: () => void handleDeleteOne(test.id, test.name) },
    ]);
  };

  const openEmptyMenu = (e: React.MouseEvent) => ctx.open(e, [
    {
      label: 'New file',
      icon: FilePlus,
      onSelect: () => openNewFile(selectedLang ?? undefined),
    },
    {
      label: allVisibleSelected ? 'Deselect all' : 'Select all',
      icon: allVisibleSelected ? Square : CheckSquare,
      separatorBefore: true,
      disabled: visibleTestIds.length === 0,
      onSelect: () => setSelectedIds(allVisibleSelected ? new Set() : new Set(visibleTestIds)),
    },
    {
      label: 'Clear selection', icon: Square,
      disabled: selectedIds.size === 0,
      onSelect: () => setSelectedIds(new Set()),
    },
  ]);

  const openGroupsBackgroundMenu = (e: React.MouseEvent) => ctx.open(e, [
    {
      label: 'Reorganize', icon: ArrowUpDown,
      submenu: [
        { label: 'Name A-Z', onSelect: () => setGroupSort('name-asc') },
        { label: 'Name Z-A', onSelect: () => setGroupSort('name-desc') },
        { label: 'Most tests', onSelect: () => setGroupSort('count-desc') },
      ],
    },
    switchViewItem(),
  ]);

  const openLangsBackgroundMenu = (e: React.MouseEvent) => ctx.open(e, [
    { label: 'New file', icon: FilePlus, onSelect: () => openNewFile() },
    {
      label: 'Reorganize', icon: ArrowUpDown, separatorBefore: true,
      submenu: [
        { label: 'Name A-Z', onSelect: () => setLangSort('name-asc') },
        { label: 'Name Z-A', onSelect: () => setLangSort('name-desc') },
        { label: 'Most tests', onSelect: () => setLangSort('count-desc') },
      ],
    },
    switchViewItem(),
  ]);

  // Clear selection whenever we leave the test-file level.
  useEffect(() => {
    if (!selectedGroup || !selectedLang || selectedTest) {
      if (selectedIds.size > 0) setSelectedIds(new Set());
    }
  }, [selectedGroup, selectedLang, selectedTest, selectedIds.size]);

  // Reset filters when the open folder changes.
  useEffect(() => {
    setSearchName('');
    setSearchQueryText('');
    setStatusFilter('');
  }, [selectedGroup, selectedLang]);

  const refreshTests = () => queryClient.invalidateQueries({ queryKey: ['rag-studio', 'storage', 'tests-all'] });

  const openNewFile = (initialLang?: string, groupOverride?: string) => {
    const group = groupOverride ?? selectedGroup;
    if (!group) return;
    setNewFileTarget({ group, initialLang: initialLang ?? selectedLang ?? 'en' });
    setNewFileError(null);
  };

  const closeNewFile = () => {
    setNewFileTarget(null);
    setNewFileError(null);
  };

  const submitNewFile = (value: string) => {
    if (!newFileTarget) return;
    const lang = normalizeLangFileName(value);
    if (!lang) return;
    if (/[\\/]/.test(lang)) {
      setNewFileError('Use a language code, not a path.');
      return;
    }
    setEmptyFiles((prev) => {
      const exists = prev.some((file) => file.group === newFileTarget.group && file.lang === lang);
      if (exists) return prev;
      return [...prev, { group: newFileTarget.group, lang, createdAt: new Date().toISOString() }];
    });
    setSelectedGroup(newFileTarget.group);
    setSelectedLang(lang);
    closeNewFile();
  };

  const openRenameLangFile = (lang: string) => {
    setRenameTarget({ type: 'lang', lang });
    setRenameError(null);
  };

  const openRenameTest = (test: TestFileRow) => {
    setRenameTarget({ type: 'test', test });
    setRenameError(null);
  };

  const closeRename = () => {
    if (renameBusy) return;
    setRenameTarget(null);
    setRenameError(null);
  };

  const submitRenameLangFile = async (lang: string, nextLang: string) => {
    const normalizedNextLang = normalizeLangFileName(nextLang);
    if (!selectedGroup || normalizedNextLang === lang) return;
    if (!normalizedNextLang || /[\\/]/.test(normalizedNextLang)) {
      throw new Error('Use a language code, not a path.');
    }
    const tests = byGroupLang[selectedGroup]?.[lang] ?? [];
    try {
      await Promise.all(tests.map((test) => apiClient.patch(`/routing-tests/${test.id}`, { lang: normalizedNextLang })));
      setEmptyFiles((prev) => prev.map((file) =>
        file.group === selectedGroup && file.lang === lang
          ? { ...file, lang: normalizedNextLang }
          : file,
      ));
      if (selectedLang === lang) setSelectedLang(normalizedNextLang);
      await refreshTests();
    } catch (err) {
      console.error('Rename language file failed:', err);
      throw err;
    }
  };

  const submitRenameTest = async (test: TestFileRow, nextName: string) => {
    if (nextName === test.name) return;
    try {
      await apiClient.patch(`/routing-tests/${test.id}`, { name: nextName });
      await refreshTests();
    } catch (err) {
      console.error('Rename test failed:', err);
      throw err;
    }
  };

  const submitRename = async (nextValue: string) => {
    if (!renameTarget) return;
    setRenameBusy(true);
    setRenameError(null);
    try {
      if (renameTarget.type === 'lang') {
        await submitRenameLangFile(renameTarget.lang, nextValue);
      } else {
        await submitRenameTest(renameTarget.test, nextValue);
      }
      setRenameTarget(null);
    } catch {
      setRenameError('Could not rename this item.');
    } finally {
      setRenameBusy(false);
    }
  };

  const openRemoveLangFile = (lang: string) => {
    if (!selectedGroup) return;
    setRemoveLangTarget({ group: selectedGroup, lang });
    setRemoveLangError(null);
  };

  const closeRemoveLangFile = () => {
    if (removeLangBusy) return;
    setRemoveLangTarget(null);
    setRemoveLangError(null);
  };

  const submitRemoveLangFile = async () => {
    if (!removeLangTarget) return;
    const target = removeLangTarget;
    setRemoveLangBusy(true);
    setRemoveLangError(null);
    try {
      const tests = byGroupLang[target.group]?.[target.lang] ?? [];
      const ids = tests.map((test) => test.id);
      if (ids.length > 0) await apiClient.post('/routing-tests/delete-batch', { ids });
      setEmptyFiles((prev) => prev.filter((file) => !(file.group === target.group && file.lang === target.lang)));
      if (selectedGroup === target.group && selectedLang === target.lang) {
        setSelectedLang(null);
        setSelectedTestId(null);
        setSelectedIds(new Set());
      }
      setRemoveLangTarget(null);
      await refreshTests();
    } catch (err) {
      console.error('Remove test file failed:', err);
      setRemoveLangError('Could not remove this language file.');
    } finally {
      setRemoveLangBusy(false);
    }
  };

  const handleBulkMove = async (lang: string) => {
    if (selectedIds.size === 0) return;
    setBulkBusy(true);
    try {
      const ids = [...selectedIds];
      await Promise.all(ids.map((id) => apiClient.patch(`/routing-tests/${id}`, { lang })));
      setSelectedIds(new Set());
      await refreshTests();
    } catch (err) {
      console.error('Bulk move failed:', err);
    } finally {
      setBulkBusy(false);
    }
  };

  const handleRunAll = async (tests: TestFileRow[]) => {
    if (tests.length === 0 || runAllProgress) return;
    setRunAllProgress({ done: 0, total: tests.length });
    try {
      for (let i = 0; i < tests.length; i++) {
        setRunningId(tests[i].id);
        try {
          await apiClient.post(`/routing-tests/${tests[i].id}/run`);
        } catch (err) {
          console.error(`Run failed for ${tests[i].name}:`, err);
        }
        setRunAllProgress({ done: i + 1, total: tests.length });
      }
      await refreshTests();
    } finally {
      setRunningId(null);
      setRunAllProgress(null);
    }
  };

  const handleRunOne = async (id: string) => {
    setRunningId(id);
    try {
      await apiClient.post(`/routing-tests/${id}/run`);
      await refreshTests();
    } catch (err) {
      console.error('Run failed:', err);
    } finally {
      setRunningId(null);
    }
  };

  const handleDeleteOne = async (id: string, name: string) => {
    if (!window.confirm(`Delete test "${name}"?`)) return;
    try {
      await apiClient.delete(`/routing-tests/${id}`);
      await refreshTests();
    } catch (err) {
      console.error('Delete failed:', err);
    }
  };

  const handleMoveOne = async (id: string, lang: string) => {
    try {
      await apiClient.patch(`/routing-tests/${id}`, { lang });
      await refreshTests();
    } catch (err) {
      console.error('Move failed:', err);
    }
  };

  const openAddForm = () => {
    createForm.resetForm();
    createForm.setForm('lang', selectedLang ?? 'en');
    createForm.setShowForm(true);
  };

  const handleCreate = async () => {
    const expectedTools = [...new Set(createForm.formExpectedTools.map((t) => t.trim()).filter(Boolean))];
    const { form } = createForm;
    if (!form.name.trim() || !form.query.trim() || expectedTools.length === 0) return;
    setSaving(true);
    try {
      await apiClient.post('/routing-tests', {
        name: form.name.trim(),
        query: form.query.trim(),
        lang: form.lang.trim() || (selectedLang ?? 'und'),
        expectedTools,
      });
      createForm.resetForm();
      await refreshTests();
    } catch (err) {
      console.error('Create failed:', err);
    } finally {
      setSaving(false);
    }
  };

  const handleExportVisible = () => {
    if (visibleTests.length === 0) return;
    const payload = {
      format: 'najm-rag-routing-tests',
      version: 2,
      exportedCount: visibleTests.length,
      group: selectedGroup,
      lang: selectedLang,
      tests: visibleTests.map((t) => ({
        id: t.id,
        name: t.name,
        query: t.query,
        lang: t.lang ?? 'und',
        expectedTools: t.expectedTools,
      })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${selectedGroup}-${selectedLang}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const createCanSave =
    !!createForm.form.name.trim() &&
    !!createForm.form.query.trim() &&
    createForm.formExpectedTools.length > 0 &&
    !saving;


  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`Delete ${selectedIds.size} test${selectedIds.size === 1 ? '' : 's'}?`)) return;
    setBulkBusy(true);
    try {
      const ids = [...selectedIds];
      await apiClient.post('/routing-tests/delete-batch', { ids });
      setSelectedIds(new Set());
      await refreshTests();
    } catch (err) {
      console.error('Bulk delete failed:', err);
    } finally {
      setBulkBusy(false);
    }
  };

  const breadcrumb = useMemo(
    () => [
      {
        label: 'Tests',
        onClick: () => { setSelectedTestId(null); setSelectedLang(null); setSelectedGroup(null); },
      },
      ...(selectedGroup
        ? [{ label: selectedGroup, onClick: () => { setSelectedTestId(null); setSelectedLang(null); } }]
        : []),
      ...(selectedLang
        ? [{ label: `${selectedLang}.json`, onClick: () => setSelectedTestId(null) }]
        : []),
      ...(selectedTest ? [{ label: selectedTest.name }] : []),
    ],
    [selectedGroup, selectedLang, selectedTest],
  );

  const loading = toolsQuery.isLoading || testsQuery.isLoading;
  const atTestFileLevel = !selectedTest && !!selectedGroup && !!selectedLang;

  const headerSubtitle = useMemo(() => {
    if (selectedTest) return `${selectedGroup} / ${selectedLang} / ${selectedTest.name}`;
    if (atTestFileLevel) {
      const base = `${selectedGroup} / ${selectedLang}.json`;
      const countLabel = visibleTests.length === selectedTests.length
        ? `${selectedTests.length} test${selectedTests.length === 1 ? '' : 's'}`
        : `${visibleTests.length} of ${selectedTests.length} tests`;
      const progress = runAllProgress ? ` · Running ${runAllProgress.done} / ${runAllProgress.total}` : '';
      return `${base} · ${countLabel}${progress}`;
    }
    if (selectedGroup) {
      const count = langEntries.length;
      return `${selectedGroup} · ${count} file${count === 1 ? '' : 's'}`;
    }
    const count = groupEntries.length;
    return `${count} group${count === 1 ? '' : 's'}`;
  }, [selectedTest, selectedGroup, selectedLang, atTestFileLevel, visibleTests.length, selectedTests.length, runAllProgress, langEntries.length, groupEntries.length]);

  const headerActions = useMemo(() => {
    if (!atTestFileLevel) return null;
    return (
      <>
        <Button
          size="sm"
          variant="outline"
          disabled={visibleTests.length === 0}
          onClick={handleExportVisible}
          className="gap-1.5"
          title="Export visible tests"
        >
          <Download className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Export</span>
        </Button>
        <Button
          size="sm"
          onClick={openAddForm}
          disabled={createForm.showForm}
          className="gap-1.5"
        >
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Add Test</span>
        </Button>
        <Button
          size="sm"
          variant="outline"
          disabled={visibleTests.length === 0 || !!runAllProgress}
          onClick={() => void handleRunAll(visibleTests)}
          className="gap-1.5"
          title="Run visible tests"
        >
          {runAllProgress
            ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
            : <PlayCircle className="h-3.5 w-3.5" />}
          <span className="hidden sm:inline">Run all</span>
        </Button>
      </>
    );
  }, [atTestFileLevel, visibleTests, createForm.showForm, runAllProgress]);

  const renderTableToolbar = () => (
    <TestFilters
      searchQuery={searchName}
      onSearchQueryChange={setSearchName}
      querySearch={searchQueryText}
      onQuerySearchChange={setSearchQueryText}
      toolFilter=""
      onToolFilterChange={() => {}}
      statusFilter={statusFilter}
      onStatusFilterChange={setStatusFilter}
      availableTools={[]}
      statusOptions={statusOptions}
      showToolFilter={false}
    />
  );

  return (
    <div
      className="h-full"
      onContextMenu={(e) => {
        if (e.defaultPrevented) return;
        if (selectedTest || atTestFileLevel) return;
        if (!selectedGroup) openGroupsBackgroundMenu(e);
        else openLangsBackgroundMenu(e);
      }}
    >
    <NPageHeader
      icon={TestTube}
      title="Storage / Tests"
      subtitle={headerSubtitle}
      actions={headerActions}
      top={
        <div className="border-b border-border px-4 py-2 sm:px-5">
          <Breadcrumb segments={breadcrumb} />
        </div>
      }
      footer={
        atTestFileLevel && selectedIds.size > 0 ? (
          <div className="relative h-0 w-full">
            <NBulkActionsBar
              count={selectedIds.size}
              busy={bulkBusy}
              variant="floating"
              onClear={() => setSelectedIds(new Set())}
              onAction={async (id, value) => {
                if (id === 'move' && value) await handleBulkMove(value);
                else if (id === 'delete') await handleBulkDelete();
              }}
              actions={[
                {
                  type: 'select',
                  id: 'move',
                  label: 'Move to',
                  icon: FolderInput,
                  placeholder: 'lang…',
                  buttonLabel: 'Move',
                  options: ALL_LANG_OPTIONS
                    .filter((o) => o.value !== selectedLang)
                    .map((o) => ({ value: o.value, label: `${o.label} (${o.value})` })),
                } as NBulkAction,
                { id: 'delete', label: 'Delete', icon: Trash2, danger: true } as NBulkAction,
              ]}
            />
          </div>
        ) : undefined
      }
    >
      {selectedTest && (
        <TestFileView
          test={selectedTest}
          availableTools={availableTools}
          onDeleted={() => setSelectedTestId(null)}
          onMoved={() => { setSelectedTestId(null); setSelectedLang(null); }}
        />
      )}

      {!selectedTest && !selectedGroup && (
        <div className="p-4">
          <NFileBrowser
            nodes={groupEntries.map(({ group, count }): FileNode => ({
              key: group,
              name: group,
              isFolder: true,
              meta: { subtitle: `${count} test${count === 1 ? '' : 's'}` },
            }))}
            mode={viewMode}
            onModeChange={setViewMode}
            availableModes={['cards', 'table']}
            showViewToggle={false}
            renderCard={({ data, onClick, onContextMenu }: NFileBrowserCardProps) => (
              <FolderCard
                label={data.name}
                subtitle={data.meta?.subtitle as string}
                onOpen={onClick ?? (() => {})}
                onContextMenu={onContextMenu}
              />
            )}
            onOpen={(n) => setSelectedGroup(n.key)}
            onContextMenu={(e, n) => openGroupMenu(e, n.key)}
            onBackgroundContextMenu={openGroupsBackgroundMenu}
            loading={loading}
            loadingText="Loading tests…"
            noDataText="No tests yet."
          />
        </div>
      )}

      {!selectedTest && selectedGroup && !selectedLang && (
        <div className="p-4">
          <NFileBrowser
            nodes={langEntries.map(({ lang, count }): FileNode => ({
              key: lang,
              name: `${lang}.json`,
              isFolder: false,
              mimeType: 'application/json',
              meta: { subtitle: `${count} test${count === 1 ? '' : 's'}` },
            }))}
            mode={viewMode}
            onModeChange={setViewMode}
            availableModes={['cards', 'table']}
            showViewToggle={false}
            renderCard={({ data, onClick, onContextMenu }: NFileBrowserCardProps) => (
              <FolderCard
                variant="file"
                label={data.name}
                subtitle={data.meta?.subtitle as string}
                onOpen={onClick ?? (() => {})}
                onContextMenu={onContextMenu}
              />
            )}
            onOpen={(n) => setSelectedLang(n.key)}
            onContextMenu={(e, n) => openLangMenu(e, n.key)}
            onBackgroundContextMenu={openLangsBackgroundMenu}
            noDataText="No tests in this group."
          />
        </div>
      )}

      {atTestFileLevel && (
        <TestsFileTable
          tests={visibleTests}
          selectedIds={selectedIds}
          runningId={runningId}
          onSelectionChange={(ids) => setSelectedIds(new Set(ids))}
          onOpen={(id) => setSelectedTestId(id)}
          onRun={(id) => void handleRunOne(id)}
          onDelete={(id, name) => void handleDeleteOne(id, name)}
          onContextMenuRow={openTestMenu}
          onContextMenuEmpty={openEmptyMenu}
          renderToolbar={renderTableToolbar}
        />
      )}

      {ctx.menu}

      <NSheet
        open={createForm.showForm}
        onOpenChange={(o) => { if (!o) createForm.resetForm(); }}
        title="New Test Case"
        description={selectedGroup && selectedLang ? `Will be saved to ${selectedGroup} / ${selectedLang}.json` : undefined}
        width={480}
      >
        <TestCaseForm
          availableTools={availableTools}
          form={createForm.form}
          formExpectedTools={createForm.formExpectedTools}
          editingId={null}
          onFormChange={createForm.setForm}
          onAddExpectedTool={() => createForm.addExpectedTool(createForm.form.expectedTool)}
          onRemoveExpectedTool={createForm.removeExpectedTool}
          onSave={handleCreate}
          onCancel={createForm.resetForm}
          canSave={createCanSave}
        />
      </NSheet>

      <RenameValueSheet
        target={newFileTarget ? {
          title: 'New language file',
          description: `${newFileTarget.group} / empty JSON file`,
          label: 'Language code',
          initialValue: newFileTarget.initialLang,
          placeholder: 'en',
        } : null}
        error={newFileError}
        submitLabel="Create"
        allowUnchanged
        onClose={closeNewFile}
        onSubmit={submitNewFile}
      />

      <RenameValueSheet
        target={renameTarget ? {
          title: renameTarget.type === 'lang' ? 'Rename language file' : 'Rename test',
          description: renameTarget.type === 'lang'
            ? selectedGroup
              ? `${selectedGroup} / ${renameTarget.lang}.json`
              : `${renameTarget.lang}.json`
            : renameTarget.test.name,
          label: renameTarget.type === 'lang' ? 'Language code' : 'Test name',
          initialValue: renameTarget.type === 'lang' ? renameTarget.lang : renameTarget.test.name,
          placeholder: renameTarget.type === 'lang' ? 'en' : 'Test name',
        } : null}
        busy={renameBusy}
        error={renameError}
        onClose={closeRename}
        onSubmit={(value) => void submitRename(value)}
      />

      <RemoveValueSheet
        target={removeLangTarget ? {
          title: 'Remove language file',
          description: `${removeLangTarget.group} / ${removeLangTarget.lang}.json`,
          itemName: `${removeLangTarget.lang}.json`,
          warning: 'This removes every test in this language file and cannot be undone.',
        } : null}
        busy={removeLangBusy}
        error={removeLangError}
        onClose={closeRemoveLangFile}
        onConfirm={() => void submitRemoveLangFile()}
      />
    </NPageHeader>
    </div>
  );
}
