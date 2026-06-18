import React, { useMemo } from 'react';
import {
  ArrowUpDown,
  Eye,
  FilePlus,
  LayoutGrid,
  List,
  Pencil,
  Trash2,
} from 'lucide-react';
import {
  NFileBrowser,
  useContextMenu,
  type ContextMenuItem,
  type FileNode,
  type FileBrowserMode,
  type NFileBrowserCardProps,
} from 'najm-kit';
import { FolderCard } from './FolderCard';
import { Breadcrumb } from './Breadcrumb';
import type { BreadcrumbSegment } from '../types';

export interface LogicalFilesBrowserGroup {
  key: string;
  label: string;
  subtitle?: string;
}

export interface LogicalFilesBrowserFile {
  key: string;
  name: string;
  subtitle?: string;
  mimeType?: string;
}

export type LogicalFileSort =
  | { key: 'name'; dir: 'asc' | 'desc' }
  | { key: 'count'; dir: 'desc' }
  | { key: 'modified'; dir: 'asc' | 'desc' };

export interface LogicalFilesBrowserProps {
  title?: string;
  workspaceLabel?: string;
  rootLabel: string;
  groups: LogicalFilesBrowserGroup[];
  files: LogicalFilesBrowserFile[];
  selectedGroup: string | null;
  selectedFile?: string | null;
  viewMode: 'cards' | 'table';
  loading?: boolean;
  emptyGroupsText?: string;
  emptyFilesText?: string;
  showModifiedSort?: boolean;
  onViewModeChange: (mode: 'cards' | 'table') => void;
  onOpenGroup: (group: string) => void;
  onOpenFile: (file: string) => void;
  onBackToRoot: () => void;
  onBackToWorkspace?: () => void;
  onNewFile: (group: string, initialName?: string) => void;
  onRenameFile: (file: string) => void;
  onRemoveFile: (file: string) => void;
  onSortGroups: (sort: LogicalFileSort) => void;
  onSortFiles: (sort: LogicalFileSort) => void;
}

export function LogicalFilesBreadcrumb({
  workspaceLabel,
  rootLabel,
  selectedGroup,
  selectedFile,
  onBackToRoot,
  onBackToWorkspace,
  onOpenGroup,
}: {
  workspaceLabel?: string;
  rootLabel: string;
  selectedGroup: string | null;
  selectedFile?: string | null;
  onBackToRoot: () => void;
  onBackToWorkspace?: () => void;
  onOpenGroup: (group: string) => void;
}) {
  const segments = useMemo<BreadcrumbSegment[]>(() => {
    const next: BreadcrumbSegment[] = [];
    if (workspaceLabel) {
      next.push({ label: workspaceLabel, onClick: onBackToWorkspace ?? onBackToRoot });
    }
    next.push({ label: rootLabel, onClick: onBackToRoot });
    if (selectedGroup) {
      next.push({
        label: selectedGroup,
        onClick: selectedFile ? () => onOpenGroup(selectedGroup) : undefined,
      });
    }
    if (selectedFile) next.push({ label: selectedFile });
    return next;
  }, [rootLabel, selectedGroup, selectedFile, workspaceLabel, onBackToRoot, onBackToWorkspace, onOpenGroup]);

  return <Breadcrumb segments={segments} />;
}

export function LogicalFilesBrowser({
  workspaceLabel,
  rootLabel,
  groups,
  files,
  selectedGroup,
  selectedFile,
  viewMode,
  loading = false,
  emptyGroupsText = 'No groups found.',
  emptyFilesText = 'No files in this group.',
  showModifiedSort = false,
  onViewModeChange,
  onOpenGroup,
  onOpenFile,
  onBackToRoot,
  onBackToWorkspace,
  onNewFile,
  onRenameFile,
  onRemoveFile,
  onSortGroups,
  onSortFiles,
}: LogicalFilesBrowserProps) {
  const ctx = useContextMenu();

  const switchViewItem = (): ContextMenuItem => ({
    label: 'View as',
    icon: viewMode === 'cards' ? LayoutGrid : List,
    separatorBefore: true,
    submenu: [
      {
        label: viewMode === 'cards' ? '✓ Cards' : 'Cards',
        icon: LayoutGrid,
        onSelect: () => onViewModeChange('cards'),
      },
      {
        label: viewMode === 'table' ? '✓ List' : 'List',
        icon: List,
        onSelect: () => onViewModeChange('table'),
      },
    ],
  });

  const sortItems = (setter: (sort: LogicalFileSort) => void): ContextMenuItem[] => {
    const items: ContextMenuItem[] = [
      { label: 'Name A-Z', onSelect: () => setter({ key: 'name', dir: 'asc' }) },
      { label: 'Name Z-A', onSelect: () => setter({ key: 'name', dir: 'desc' }) },
      { label: 'Most items', onSelect: () => setter({ key: 'count', dir: 'desc' }) },
    ];
    if (showModifiedSort) {
      items.push({ label: 'Recently modified', onSelect: () => setter({ key: 'modified', dir: 'desc' }) });
    }
    return items;
  };

  const openGroupsBackgroundMenu = (e: React.MouseEvent) =>
    ctx.open(e, [
      { label: 'Reorganize', icon: ArrowUpDown, submenu: sortItems(onSortGroups) },
      switchViewItem(),
    ]);

  const openGroupMenu = (e: React.MouseEvent, group: string) =>
    ctx.open(e, [
      { label: 'Open', icon: Eye, onSelect: () => onOpenGroup(group) },
      {
        label: 'New file',
        icon: FilePlus,
        separatorBefore: true,
        onSelect: () => onNewFile(group),
      },
      { label: 'Reorganize', icon: ArrowUpDown, submenu: sortItems(onSortGroups) },
      switchViewItem(),
    ]);

  const openLangsBackgroundMenu = (e: React.MouseEvent) =>
    ctx.open(e, [
      { label: 'New file', icon: FilePlus, onSelect: () => { if (selectedGroup) onNewFile(selectedGroup); } },
      { label: 'Reorganize', icon: ArrowUpDown, separatorBefore: true, submenu: sortItems(onSortFiles) },
      switchViewItem(),
    ]);

  const openLangMenu = (e: React.MouseEvent, file: string) =>
    ctx.open(e, [
      { label: 'Open', icon: Eye, onSelect: () => onOpenFile(file) },
      { label: 'Rename', icon: Pencil, onSelect: () => onRenameFile(file) },
      {
        label: 'New file',
        icon: FilePlus,
        separatorBefore: true,
        onSelect: () => { if (selectedGroup) onNewFile(selectedGroup, file); },
      },
      { label: 'Reorganize', icon: ArrowUpDown, submenu: sortItems(onSortFiles) },
      switchViewItem(),
      { label: 'Remove', icon: Trash2, danger: true, separatorBefore: true, onSelect: () => onRemoveFile(file) },
    ]);

  const groupNodes: FileNode[] = useMemo(
    () =>
      groups.map((g) => ({
        key: g.key,
        name: g.label,
        isFolder: true,
        meta: g.subtitle ? { subtitle: g.subtitle } : undefined,
      })),
    [groups],
  );

  const fileNodes: FileNode[] = useMemo(
    () =>
      files.map((f) => ({
        key: f.key,
        name: f.name,
        isFolder: false,
        mimeType: f.mimeType ?? 'application/json',
        meta: f.subtitle ? { subtitle: f.subtitle } : undefined,
      })),
    [files],
  );

  return (
    <>
      {!selectedGroup && (
        <NFileBrowser
          nodes={groupNodes}
          mode={viewMode}
          onModeChange={onViewModeChange}
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
          onOpen={(n) => onOpenGroup(n.key)}
          onContextMenu={(e, n) => openGroupMenu(e, n.key)}
          onBackgroundContextMenu={openGroupsBackgroundMenu}
          loading={loading}
          loadingText="Loading groups…"
          noDataText={emptyGroupsText}
        />
      )}

      {selectedGroup && (
        <NFileBrowser
          nodes={fileNodes}
          mode={viewMode}
          onModeChange={onViewModeChange}
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
          onOpen={(n) => onOpenFile(n.key)}
          onContextMenu={(e, n) => openLangMenu(e, n.key)}
          onBackgroundContextMenu={openLangsBackgroundMenu}
          loading={loading}
          loadingText="Loading files…"
          noDataText={emptyFilesText}
        />
      )}
      {ctx.menu}
    </>
  );
}
