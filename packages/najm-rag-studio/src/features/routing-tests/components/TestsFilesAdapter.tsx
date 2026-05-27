import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '@/lib/api';
import { useLocalStorageState } from 'najm-ui';
import type { MCPTool } from '@/features/logs/types';
import type { TestCase } from '@/features/routing-tests/types';
import { LogicalFilesBrowser, type LogicalFileSort } from '@/features/storage';
import { RenameValueSheet } from '@/features/storage/components/RenameValueSheet';
import { RemoveValueSheet } from '@/features/storage/components/RemoveValueSheet';

interface EmptyTestFile {
  group: string;
  lang: string;
  createdAt: string;
}

const EMPTY_TEST_FILES_KEY = 'najm-rag-studio:storage:empty-test-files';
const UNCATEGORIZED = 'uncategorized';
const UNKNOWN_LANG = 'und';

const normalizeLangFileName = (value: string) =>
  value.trim().replace(/\.json$/i, '').trim();

interface TestsResponse {
  items: TestCase[];
  total: number;
}

interface TestsFilesAdapterProps {
  selectedGroup?: string | null;
  selectedFile?: string | null;
  onSelectedGroupChange?: (group: string | null) => void;
  onFileOpen: (group: string, lang: string) => void;
}

export function TestsFilesAdapter({
  selectedGroup: controlledSelectedGroup,
  selectedFile,
  onSelectedGroupChange,
  onFileOpen,
}: TestsFilesAdapterProps) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [emptyFiles, setEmptyFiles] = useLocalStorageState<EmptyTestFile[]>(EMPTY_TEST_FILES_KEY, []);
  const [internalSelectedGroup, setInternalSelectedGroup] = useState<string | null>(null);
  const [groupSort, setGroupSort] = useState<LogicalFileSort>({ key: 'name', dir: 'asc' });
  const [langSort, setLangSort] = useState<LogicalFileSort>({ key: 'name', dir: 'asc' });
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  const [newFileTarget, setNewFileTarget] = useState<{ group: string; initialLang: string } | null>(null);
  const [newFileError, setNewFileError] = useState<string | null>(null);
  const [renameLang, setRenameLang] = useState<string | null>(null);
  const [renameBusy, setRenameBusy] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [removeLang, setRemoveLang] = useState<{ group: string; lang: string } | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const selectedGroup = controlledSelectedGroup !== undefined ? controlledSelectedGroup : internalSelectedGroup;

  const setSelectedGroup = (group: string | null) => {
    if (controlledSelectedGroup !== undefined) onSelectedGroupChange?.(group);
    else setInternalSelectedGroup(group);
  };

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

  const byGroupLang = useMemo<Record<string, Record<string, TestCase[]>>>(() => {
    const out: Record<string, Record<string, TestCase[]>> = {};
    for (const group of new Set(Object.values(toolGroupByName))) {
      out[group] ??= {};
    }
    for (const test of testsQuery.data?.items ?? []) {
      const firstTool = test.expectedTools[0];
      const group = (firstTool && toolGroupByName[firstTool]) || UNCATEGORIZED;
      const lang = (test.lang && test.lang.trim()) || UNKNOWN_LANG;
      (out[group] ??= {});
      (out[group][lang] ??= []).push(test);
    }
    return out;
  }, [testsQuery.data, toolGroupByName]);

  const groups = useMemo(() => {
    let entries = Object.entries(byGroupLang).map(([group, langs]) => ({
      key: group,
      label: group,
      subtitle: `${Object.values(langs).reduce((sum, arr) => sum + arr.length, 0)} test${Object.values(langs).reduce((sum, arr) => sum + arr.length, 0) === 1 ? '' : 's'}`,
    }));
    if (groupSort.key === 'count') {
      entries = entries.sort((a, b) => {
        const aCount = parseInt(a.subtitle?.split(' ')[0] ?? '0');
        const bCount = parseInt(b.subtitle?.split(' ')[0] ?? '0');
        return bCount - aCount || a.label.localeCompare(b.label);
      });
    } else {
      entries = entries.sort((a, b) =>
        groupSort.dir === 'asc' ? a.label.localeCompare(b.label) : b.label.localeCompare(a.label)
      );
    }
    return entries;
  }, [byGroupLang, groupSort]);

  const files = useMemo(() => {
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
    let entries = [...entriesByLang.values()].map((e) => ({
      key: e.lang,
      name: `${e.lang}.json`,
      subtitle: `${e.count} test${e.count === 1 ? '' : 's'}`,
    }));
    if (langSort.key === 'count') {
      entries = entries.sort((a, b) => {
        const aCount = parseInt(a.subtitle?.split(' ')[0] ?? '0');
        const bCount = parseInt(b.subtitle?.split(' ')[0] ?? '0');
        return bCount - aCount || a.name.localeCompare(b.name);
      });
    } else {
      entries = entries.sort((a, b) =>
        langSort.dir === 'asc' ? a.name.localeCompare(b.name) : b.name.localeCompare(a.name)
      );
    }
    return entries;
  }, [byGroupLang, emptyFiles, selectedGroup, langSort]);

  const refreshTests = () => queryClient.invalidateQueries({ queryKey: ['rag-studio', 'storage', 'tests-all'] });

  const openNewFile = (group: string, initialLang?: string) => {
    setNewFileTarget({ group, initialLang: initialLang ?? 'en' });
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
    closeNewFile();
    onFileOpen(newFileTarget.group, lang);
  };

  const openRenameLangFile = (lang: string) => {
    setRenameLang(lang);
    setRenameError(null);
  };

  const closeRenameLangFile = () => {
    if (renameBusy) return;
    setRenameLang(null);
    setRenameError(null);
  };

  const submitRenameLangFile = async (nextLang: string) => {
    const normalizedNextLang = normalizeLangFileName(nextLang);
    if (!selectedGroup || !renameLang || normalizedNextLang === renameLang) return;
    if (!normalizedNextLang || /[\\/]/.test(normalizedNextLang)) {
      setRenameError('Use a language code, not a path.');
      return;
    }
    setRenameBusy(true);
    setRenameError(null);
    try {
      const tests = byGroupLang[selectedGroup]?.[renameLang] ?? [];
      await Promise.all(tests.map((test) => apiClient.patch(`/routing-tests/${test.id}`, { lang: normalizedNextLang })));
      setEmptyFiles((prev) => prev.map((file) =>
        file.group === selectedGroup && file.lang === renameLang
          ? { ...file, lang: normalizedNextLang }
          : file,
      ));
      setRenameLang(null);
      await refreshTests();
    } catch (err) {
      console.error('Rename test file failed:', err);
      setRenameError('Could not rename this language file.');
    } finally {
      setRenameBusy(false);
    }
  };

  const openRemoveLangFile = (lang: string) => {
    if (!selectedGroup) return;
    setRemoveLang({ group: selectedGroup, lang });
    setRemoveError(null);
  };

  const closeRemoveLangFile = () => {
    if (removeBusy) return;
    setRemoveLang(null);
    setRemoveError(null);
  };

  const submitRemoveLangFile = async () => {
    if (!removeLang) return;
    const target = removeLang;
    setRemoveBusy(true);
    setRemoveError(null);
    try {
      const tests = byGroupLang[target.group]?.[target.lang] ?? [];
      const ids = tests.map((test) => test.id);
      if (ids.length > 0) await apiClient.post('/routing-tests/delete-batch', { ids });
      setEmptyFiles((prev) => prev.filter((file) => !(file.group === target.group && file.lang === target.lang)));
      setRemoveLang(null);
      await refreshTests();
    } catch (err) {
      console.error('Remove test file failed:', err);
      setRemoveError('Could not remove this language file.');
    } finally {
      setRemoveBusy(false);
    }
  };

  return (
    <>
      <LogicalFilesBrowser
        title="Routing Tests"
        workspaceLabel="Test Runner"
        rootLabel="Files"
        groups={groups}
        files={files}
        selectedGroup={selectedGroup}
        selectedFile={selectedFile}
        viewMode={viewMode}
        loading={toolsQuery.isLoading || testsQuery.isLoading}
        emptyGroupsText="No test groups found."
        emptyFilesText="No tests in this group yet."
        onViewModeChange={setViewMode}
        onOpenGroup={(group) => setSelectedGroup(group)}
        onOpenFile={(file) => { if (selectedGroup) onFileOpen(selectedGroup, file); }}
        onBackToRoot={() => setSelectedGroup(null)}
        onBackToWorkspace={() => setSelectedGroup(null)}
        onNewFile={(group, initialName) => openNewFile(group, initialName)}
        onRenameFile={(file) => openRenameLangFile(file)}
        onRemoveFile={(file) => openRemoveLangFile(file)}
        onSortGroups={setGroupSort}
        onSortFiles={setLangSort}
      />
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
        target={renameLang ? {
          title: 'Rename language file',
          description: selectedGroup ? `${selectedGroup} / ${renameLang}.json` : `${renameLang}.json`,
          label: 'Language code',
          initialValue: renameLang,
          placeholder: 'en',
        } : null}
        busy={renameBusy}
        error={renameError}
        onClose={closeRenameLangFile}
        onSubmit={(value) => void submitRenameLangFile(value)}
      />
      <RemoveValueSheet
        target={removeLang ? {
          title: 'Remove language file',
          description: `${removeLang.group} / ${removeLang.lang}.json`,
          itemName: `${removeLang.lang}.json`,
          warning: 'This removes every test in this language file and cannot be undone.',
        } : null}
        busy={removeBusy}
        error={removeError}
        onClose={closeRemoveLangFile}
        onConfirm={() => void submitRemoveLangFile()}
      />
    </>
  );
}
