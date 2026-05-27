import React, { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowUpDown, Eye, FilePlus, LayoutGrid, List, Pencil, Tag, Trash2 } from 'lucide-react';
import { NFileBrowser, NPageHeader, useContextMenu, useLocalStorageState, type ContextMenuItem, type FileNode, type FileBrowserMode, type NFileBrowserCardProps } from 'najm-ui';
import { useApiClient } from '@/lib/api';
import type { MCPTool } from '@/features/logs/types';
import type { PaginatedSemanticsResponse, SemanticGroupsResponse } from '@/features/routing-semantics/types';
import { FolderCard } from './FolderCard';
import { Breadcrumb } from './Breadcrumb';
import { SemanticsFileView } from './SemanticsFileView';
import { RenameValueSheet } from './RenameValueSheet';
import { RemoveValueSheet } from './RemoveValueSheet';

interface GroupSummary {
  group: string;
  toolCount: number;
}

type FolderSort = 'name-asc' | 'name-desc' | 'count-desc';

interface EmptySemanticFile {
  group: string;
  lang: string;
  createdAt: string;
}

const EMPTY_SEMANTIC_FILES_KEY = 'najm-rag-studio:storage:empty-semantic-files';

const normalizeLangFileName = (value: string) =>
  value.trim().replace(/\.json$/i, '').trim();

export function SemanticsBucket() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [emptyFiles, setEmptyFiles] = useLocalStorageState<EmptySemanticFile[]>(EMPTY_SEMANTIC_FILES_KEY, []);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const [selectedLang, setSelectedLang] = useState<string | null>(null);
  const [groupSort, setGroupSort] = useState<FolderSort>('name-asc');
  const [langSort, setLangSort] = useState<FolderSort>('name-asc');
  const [viewMode, setViewMode] = useState<FileBrowserMode>('cards');
  const [newFileTarget, setNewFileTarget] = useState<{ group: string; initialLang: string } | null>(null);
  const [newFileError, setNewFileError] = useState<string | null>(null);
  const [renameLang, setRenameLang] = useState<string | null>(null);
  const [renameBusy, setRenameBusy] = useState(false);
  const [renameError, setRenameError] = useState<string | null>(null);
  const [removeLang, setRemoveLang] = useState<{ group: string; lang: string } | null>(null);
  const [removeBusy, setRemoveBusy] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const switchViewItem = (): ContextMenuItem => ({
    label: 'View as',
    icon: viewMode === 'cards' ? LayoutGrid : List,
    separatorBefore: true,
    submenu: [
      {
        label: viewMode === 'cards' ? '✓ Cards' : 'Cards',
        icon: LayoutGrid,
        onSelect: () => setViewMode('cards'),
      },
      {
        label: viewMode === 'table' ? '✓ List' : 'List',
        icon: List,
        onSelect: () => setViewMode('table'),
      },
    ],
  });

  const toolsQuery = useQuery({
    queryKey: ['rag-studio', 'storage', 'tools'],
    queryFn: () => apiClient.get<MCPTool[]>('/tools/list'),
  });

  const groups = useMemo<GroupSummary[]>(() => {
    const counts = new Map<string, number>();
    for (const tool of toolsQuery.data ?? []) {
      const g = tool.group || 'default';
      counts.set(g, (counts.get(g) ?? 0) + 1);
    }
    const entries = [...counts.entries()].map(([group, toolCount]) => ({ group, toolCount }));
    if (groupSort === 'count-desc') return entries.sort((a, b) => b.toolCount - a.toolCount || a.group.localeCompare(b.group));
    if (groupSort === 'name-desc') return entries.sort((a, b) => b.group.localeCompare(a.group));
    return entries.sort((a, b) => a.group.localeCompare(b.group));
  }, [toolsQuery.data, groupSort]);

  const langsQuery = useQuery({
    queryKey: ['rag-studio', 'storage', 'semantics-langs', selectedGroup],
    queryFn: () =>
      apiClient.get<SemanticGroupsResponse>(`/semantics/groups?toolGroup=${encodeURIComponent(selectedGroup!)}`),
    enabled: !!selectedGroup && !selectedLang,
  });

  const ctx = useContextMenu();

  const langEntries = useMemo(() => {
    const entriesByLang = new Map((langsQuery.data?.groups ?? []).map((entry) => [entry.lang, { ...entry }]));
    for (const file of emptyFiles) {
      if (file.group === selectedGroup && !entriesByLang.has(file.lang)) {
        entriesByLang.set(file.lang, { lang: file.lang, total: 0 });
      }
    }
    const entries = [...entriesByLang.values()];
    if (langSort === 'count-desc') return entries.sort((a, b) => b.total - a.total || a.lang.localeCompare(b.lang));
    if (langSort === 'name-desc') return entries.sort((a, b) => b.lang.localeCompare(a.lang));
    return entries.sort((a, b) => a.lang.localeCompare(b.lang));
  }, [emptyFiles, langsQuery.data, selectedGroup, langSort]);

  const invalidateStorageSemantics = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ['rag-studio', 'storage', 'semantics-langs'] }),
      queryClient.invalidateQueries({ queryKey: ['rag-studio', 'semantics'] }),
    ]);
  };

  const sortItems = (setter: React.Dispatch<React.SetStateAction<FolderSort>>): ContextMenuItem[] => [
    { label: 'Name A-Z', onSelect: () => setter('name-asc') },
    { label: 'Name Z-A', onSelect: () => setter('name-desc') },
    { label: 'Most phrases', onSelect: () => setter('count-desc') },
  ];

  const openNewSemanticFile = (initialLang?: string, groupOverride?: string) => {
    const group = groupOverride ?? selectedGroup;
    if (!group) return;
    setNewFileTarget({ group, initialLang: initialLang ?? 'en' });
    setNewFileError(null);
  };

  const closeNewSemanticFile = () => {
    setNewFileTarget(null);
    setNewFileError(null);
  };

  const submitNewSemanticFile = (value: string) => {
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
    closeNewSemanticFile();
  };

  const fetchAllSemanticsForLang = async (group: string, lang: string) => {
    const items: PaginatedSemanticsResponse['items'] = [];
    let offset = 0;
    const limit = 250;
    while (true) {
      const params = new URLSearchParams({
        toolGroup: group,
        lang,
        limit: String(limit),
        offset: String(offset),
      });
      const page = await apiClient.get<PaginatedSemanticsResponse>(`/semantics?${params.toString()}`);
      items.push(...(page.items ?? []));
      offset += page.limit || limit;
      if (items.length >= page.total || (page.items ?? []).length === 0) break;
    }
    return items;
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
      if (selectedLang === renameLang) setSelectedLang(normalizedNextLang);
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
      if (selectedGroup === target.group && selectedLang === target.lang) setSelectedLang(null);
      setRemoveLang(null);
      await invalidateStorageSemantics();
    } catch (err) {
      console.error('Remove semantic file failed:', err);
      setRemoveError('Could not remove this language file.');
    } finally {
      setRemoveBusy(false);
    }
  };

  const openGroupsBackgroundMenu = (e: React.MouseEvent) => ctx.open(e, [
    { label: 'Reorganize', icon: ArrowUpDown, submenu: sortItems(setGroupSort) },
    switchViewItem(),
  ]);

  const openGroupMenu = (e: React.MouseEvent, group: string) => ctx.open(e, [
    { label: 'Open', icon: Eye, onSelect: () => setSelectedGroup(group) },
    {
      label: 'New file', icon: FilePlus, separatorBefore: true,
      onSelect: () => openNewSemanticFile(undefined, group),
    },
    { label: 'Reorganize', icon: ArrowUpDown, submenu: sortItems(setGroupSort) },
    switchViewItem(),
  ]);

  const openLangsBackgroundMenu = (e: React.MouseEvent) => ctx.open(e, [
    { label: 'New file', icon: FilePlus, onSelect: () => openNewSemanticFile() },
    { label: 'Reorganize', icon: ArrowUpDown, separatorBefore: true, submenu: sortItems(setLangSort) },
    switchViewItem(),
  ]);

  const openLangMenu = (e: React.MouseEvent, lang: string) => ctx.open(e, [
    { label: 'Open', icon: Eye, onSelect: () => setSelectedLang(lang) },
    { label: 'Rename', icon: Pencil, onSelect: () => openRenameLangFile(lang) },
    { label: 'New file', icon: FilePlus, separatorBefore: true, onSelect: () => openNewSemanticFile(lang) },
    { label: 'Reorganize', icon: ArrowUpDown, submenu: sortItems(setLangSort) },
    switchViewItem(),
    { label: 'Remove', icon: Trash2, danger: true, separatorBefore: true, onSelect: () => openRemoveLangFile(lang) },
  ]);

  const breadcrumb = useMemo(
    () => [
      {
        label: 'Semantics',
        onClick: () => { setSelectedLang(null); setSelectedGroup(null); },
      },
      ...(selectedGroup
        ? [{ label: selectedGroup, onClick: () => setSelectedLang(null) }]
        : []),
      ...(selectedLang ? [{ label: `${selectedLang}.json` }] : []),
    ],
    [selectedGroup, selectedLang],
  );

  if (selectedGroup && selectedLang) {
    return (
      <SemanticsFileView
        group={selectedGroup}
        lang={selectedLang}
        top={
          <div className="border-b border-border px-4 py-2 sm:px-5">
            <Breadcrumb segments={breadcrumb} />
          </div>
        }
      />
    );
  }

  return (
    <div className="h-full"
      onContextMenu={(e) => {
        if (e.defaultPrevented) return;
        if (!selectedGroup) openGroupsBackgroundMenu(e);
        else openLangsBackgroundMenu(e);
      }}
    >
    <NPageHeader
      icon={Tag}
      title="Storage / Semantics"
      subtitle={selectedGroup ? `Languages in ${selectedGroup}` : 'Pick a group folder'}
      top={
        <div className="border-b border-border px-4 py-2 sm:px-5">
          <Breadcrumb segments={breadcrumb} />
        </div>
      }
    >
      {!selectedGroup && (
        <div className="p-4">
          <NFileBrowser
            nodes={groups.map((g): FileNode => ({
              key: g.group,
              name: g.group,
              isFolder: true,
              meta: { subtitle: `${g.toolCount} tool${g.toolCount === 1 ? '' : 's'}` },
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
            loading={toolsQuery.isLoading}
            loadingText="Loading groups…"
            noDataText="No tool groups found."
          />
        </div>
      )}

      {selectedGroup && (
        <div className="p-4">
          <NFileBrowser
            nodes={langEntries.map((entry): FileNode => ({
              key: entry.lang,
              name: `${entry.lang}.json`,
              isFolder: false,
              mimeType: 'application/json',
              meta: { subtitle: `${entry.total} phrase${entry.total === 1 ? '' : 's'}` },
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
            loading={langsQuery.isLoading}
            loadingText="Loading languages…"
            noDataText="No phrases in this group yet."
          />
        </div>
      )}
      {ctx.menu}
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
        onClose={closeNewSemanticFile}
        onSubmit={submitNewSemanticFile}
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
    </NPageHeader>
    </div>
  );
}
