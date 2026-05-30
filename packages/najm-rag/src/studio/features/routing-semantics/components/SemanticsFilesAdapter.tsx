import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useApiClient } from '@/lib/api';
import { useLocalStorageState } from 'najm-ui';
import type { MCPTool } from '@/features/logs/types';
import type { PaginatedSemanticsResponse, SemanticGroupsResponse } from '@/features/routing-semantics/types';
import { LogicalFilesBrowser, type LogicalFileSort } from '@/features/storage';
import { RenameValueSheet } from '@/features/storage/components/RenameValueSheet';
import { RemoveValueSheet } from '@/features/storage/components/RemoveValueSheet';

interface EmptySemanticFile {
  group: string;
  lang: string;
  createdAt: string;
}

const EMPTY_SEMANTIC_FILES_KEY = 'najm-rag-studio:storage:empty-semantic-files';

const normalizeLangFileName = (value: string) =>
  value.trim().replace(/\.json$/i, '').trim();

interface SemanticsFilesAdapterProps {
  selectedGroup?: string | null;
  selectedFile?: string | null;
  onSelectedGroupChange?: (group: string | null) => void;
  onFileOpen: (group: string, lang: string) => void;
}

export function SemanticsFilesAdapter({
  selectedGroup: controlledSelectedGroup,
  selectedFile,
  onSelectedGroupChange,
  onFileOpen,
}: SemanticsFilesAdapterProps) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [emptyFiles, setEmptyFiles] = useLocalStorageState<EmptySemanticFile[]>(EMPTY_SEMANTIC_FILES_KEY, []);
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

  const groups = useMemo(() => {
    const counts = new Map<string, number>();
    for (const tool of toolsQuery.data ?? []) {
      const g = tool.group || 'default';
      counts.set(g, (counts.get(g) ?? 0) + 1);
    }
    let entries = [...counts.entries()].map(([group, toolCount]) => ({ key: group, label: group, subtitle: `${toolCount} tool${toolCount === 1 ? '' : 's'}` }));
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
  }, [toolsQuery.data, groupSort]);

  const langsQuery = useQuery({
    queryKey: ['rag-studio', 'storage', 'semantics-langs', selectedGroup],
    queryFn: () =>
      apiClient.get<SemanticGroupsResponse>(`/semantics/groups?toolGroup=${encodeURIComponent(selectedGroup!)}`),
    enabled: !!selectedGroup,
  });

  const files = useMemo(() => {
    if (!selectedGroup) return [];
    const entriesByLang = new Map((langsQuery.data?.groups ?? []).map((entry) => [entry.lang, { ...entry }]));
    for (const file of emptyFiles) {
      if (file.group === selectedGroup && !entriesByLang.has(file.lang)) {
        entriesByLang.set(file.lang, { lang: file.lang, total: 0 });
      }
    }
    let entries = [...entriesByLang.values()].map((e) => ({
      key: e.lang,
      name: `${e.lang}.json`,
      subtitle: `${e.total} phrase${e.total === 1 ? '' : 's'}`,
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
  }, [emptyFiles, langsQuery.data, selectedGroup, langSort]);

  const invalidateStorageSemantics = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['rag-studio', 'storage', 'semantics-langs'] }),
      queryClient.invalidateQueries({ queryKey: ['rag-studio', 'semantics'] }),
    ]);
  };

  const fetchAllSemanticsForLang = async (group: string, lang: string) => {
    const items: PaginatedSemanticsResponse['items'] = [];
    let offset = 0;
    const limit = 250;
    while (true) {
      const params = new URLSearchParams({ toolGroup: group, lang, limit: String(limit), offset: String(offset) });
      const page = await apiClient.get<PaginatedSemanticsResponse>(`/semantics?${params.toString()}`);
      items.push(...(page.items ?? []));
      offset += page.limit || limit;
      if (items.length >= page.total || (page.items ?? []).length === 0) break;
    }
    return items;
  };

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
      const phrases = await fetchAllSemanticsForLang(selectedGroup, renameLang);
      await Promise.all(phrases.map((phrase) => apiClient.patch(`/semantics/${phrase.id}`, { lang: normalizedNextLang })));
      setEmptyFiles((prev) => prev.map((file) =>
        file.group === selectedGroup && file.lang === renameLang
          ? { ...file, lang: normalizedNextLang }
          : file,
      ));
      setRenameLang(null);
      await invalidateStorageSemantics();
    } catch (err) {
      console.error('Rename semantic file failed:', err);
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
      const phrases = await fetchAllSemanticsForLang(target.group, target.lang);
      const ids = phrases.map((phrase) => phrase.id);
      if (ids.length > 0) await apiClient.post('/semantics/delete-batch', { ids });
      setEmptyFiles((prev) => prev.filter((file) => !(file.group === target.group && file.lang === target.lang)));
      setRemoveLang(null);
      await invalidateStorageSemantics();
    } catch (err) {
      console.error('Remove semantic file failed:', err);
      setRemoveError('Could not remove this language file.');
    } finally {
      setRemoveBusy(false);
    }
  };

  return (
    <>
      <LogicalFilesBrowser
        title="Semantic Phrases"
        workspaceLabel="Semantics"
        rootLabel="Files"
        groups={groups}
        files={files}
        selectedGroup={selectedGroup}
        selectedFile={selectedFile}
        viewMode={viewMode}
        loading={toolsQuery.isLoading || (!!selectedGroup && langsQuery.isLoading)}
        emptyGroupsText="No tool groups found."
        emptyFilesText="No phrases in this group yet."
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
          warning: 'This removes every phrase in this language file and cannot be undone.',
        } : null}
        busy={removeBusy}
        error={removeError}
        onClose={closeRemoveLangFile}
        onConfirm={() => void submitRemoveLangFile()}
      />
    </>
  );
}
