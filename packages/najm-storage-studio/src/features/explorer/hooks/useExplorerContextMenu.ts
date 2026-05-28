import { useCallback } from 'react';
import { toast } from 'sonner';
import { Info, LayoutGrid, List } from 'lucide-react';
import { useStorageContextMenu, type StorageTarget } from 'najm-ui';
import type { SortKey, SortDir, FileItem } from '../types';
import type { ExplorerMutations } from './useExplorerMutations';
import type { ExplorerClipboard } from './useExplorerClipboard';
import type { ExplorerDialogs } from './useExplorerDialogs';

interface Options {
  files: FileItem[];
  selected: Set<string>;
  dialogs: ExplorerDialogs;
  clipboard: ExplorerClipboard;
  mutations: ExplorerMutations;
  sortKey: SortKey;
  sortDir: SortDir;
  onSortChange: (k: SortKey) => void;
  onSelectAll: () => void;
  onUploadClick: () => void;
  view: 'list' | 'grid';
  onViewChange: (view: 'list' | 'grid') => void;
  onProperties: (file: FileItem) => void;
}

/**
 * Adapter that turns the explorer's domain state (selection, sort, dialogs,
 * clipboard) into a populated `useStorageContextMenu` instance. Returns the
 * standard `{ openItem, openBackground, close, menu }` shape from najm-ui.
 */
export function useExplorerContextMenu({
  files, selected, dialogs, clipboard, mutations, sortKey, sortDir, onSortChange, onSelectAll, onUploadClick, view, onViewChange, onProperties,
}: Options) {
  const switchView = useCallback(() => {
    onViewChange(view === 'grid' ? 'list' : 'grid');
  }, [onViewChange, view]);

  const switchViewItem = () => {
    const next: 'list' | 'grid' = view === 'grid' ? 'list' : 'grid';
    return {
      id: 'switch-view',
      label: next === 'grid' ? 'Show as cards' : 'Show as list',
      icon: next === 'grid' ? LayoutGrid : List,
      separatorBefore: true,
    };
  };
  const expandTargets = useCallback((key: string): string[] => (
    selected.has(key) && selected.size > 1 ? Array.from(selected) : [key]
  ), [selected]);

  const handleShare = useCallback(async (t: StorageTarget) => {
    try {
      const url = await mutations.presign(t.key);
      await navigator.clipboard?.writeText(url).catch(() => {});
      toast.success('Share link copied to clipboard.');
    } catch (e: any) {
      toast.error(e?.message ?? 'Share failed');
    }
  }, [mutations]);

  const handleDownload = useCallback((t: StorageTarget) => {
    const file = files.find((f) => f.filePath === t.key);
    if (file?.url) window.open(file.url, '_blank');
  }, [files]);

  const sortSuffix = (k: SortKey) => sortKey === k ? (sortDir === 'asc' ? ' ↑' : ' ↓') : '';

  return useStorageContextMenu({
    canOpen: false,
    canDownload: true,
    canRename: true,
    canCut: true, canCopy: true, canPaste: true,
    canMove: true, canShare: true, canDelete: true,
    canNewFolder: true, canNewFile: true, canSelectAll: true,
    hasClipboard: clipboard.hasClipboard,
    sortOptions: [
      { id: 'name',     label: 'Name',     suffix: sortSuffix('name') },
      { id: 'size',     label: 'Size',     suffix: sortSuffix('size') },
      { id: 'modified', label: 'Modified', suffix: sortSuffix('modified') },
      { id: 'type',     label: 'Type',     suffix: sortSuffix('type') },
    ],
    onDownload:  handleDownload,
    onRename:    (t) => dialogs.rename.open(t.key),
    onCut:       (t) => clipboard.cut(expandTargets(t.key)),
    onCopy:      (t) => clipboard.copy(expandTargets(t.key)),
    onPaste:     clipboard.paste,
    onMove:      (t) => dialogs.move.open(expandTargets(t.key)),
    onShare:     handleShare,
    onDelete:    (t) => dialogs.delete.open(expandTargets(t.key)),
    onNewFolder: dialogs.newFolder.open,
    onNewFile:   onUploadClick,
    onSelectAll,
    onSort:      (id) => onSortChange(id as SortKey),
    itemExtras:        (target) => [
      ...(target.isFolder ? [] : [{ id: 'properties', label: 'Properties', icon: Info, separatorBefore: true }]),
      switchViewItem(),
    ],
    backgroundExtras:  () => [switchViewItem()],
    onItemExtraAction: (action, target) => {
      if (action === 'switch-view') switchView();
      if (action === 'properties') {
        const file = files.find((f) => f.filePath === target.key);
        if (file) onProperties(file);
      }
    },
    onBackgroundExtraAction: (action) => { if (action === 'switch-view') switchView(); },
  });
}
