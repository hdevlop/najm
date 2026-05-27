import React, { useCallback, useMemo, useState } from 'react';
import {
  Download, Pencil, Copy, Scissors, ClipboardPaste, Trash2, Share2, Move,
  FolderPlus, FilePlus, CheckSquare, ArrowUpDown, Eye, type LucideIcon,
} from 'lucide-react';
import { NContextMenu, type NContextMenuItem } from './NContextMenu';

/** A single item the menu acts on (file, folder, group, lang, etc.). */
export interface StorageTarget<T = unknown> {
  key: string;
  isFolder?: boolean;
  data?: T;
}

type MenuKind<T> =
  | { kind: 'item'; target: StorageTarget<T> }
  | { kind: 'background' };

type MenuState<T> = ({ x: number; y: number } & MenuKind<T>) | null;

export interface StorageSortOption {
  id: string;
  label: string;
  /** Optional direction suffix shown in the label, e.g. ' ↑'. */
  suffix?: string;
}

export interface UseStorageContextMenuOptions<T = unknown> {
  // ---- capabilities (omit / false to hide the corresponding item) ----
  canOpen?: boolean;
  canDownload?: boolean;
  canRename?: boolean;
  canCut?: boolean;
  canCopy?: boolean;
  canPaste?: boolean;
  canMove?: boolean;
  canShare?: boolean;
  canDelete?: boolean;
  canNewFolder?: boolean;
  canNewFile?: boolean;
  canSelectAll?: boolean;
  /** When provided, a "Reorganize" submenu is shown in the background menu. */
  sortOptions?: StorageSortOption[];

  /** Disables Paste when no clipboard contents are available. */
  hasClipboard?: boolean;

  // ---- handlers ----
  onOpen?: (target: StorageTarget<T>) => void;
  onDownload?: (target: StorageTarget<T>) => void;
  onRename?: (target: StorageTarget<T>) => void;
  onCut?: (target: StorageTarget<T>) => void;
  onCopy?: (target: StorageTarget<T>) => void;
  onPaste?: () => void;
  onMove?: (target: StorageTarget<T>) => void;
  onShare?: (target: StorageTarget<T>) => void;
  onDelete?: (target: StorageTarget<T>) => void;
  onNewFolder?: () => void;
  onNewFile?: () => void;
  onSelectAll?: () => void;
  onSort?: (id: string) => void;

  // ---- domain-specific extras (appended after the standard items) ----
  itemExtras?: (target: StorageTarget<T>) => NContextMenuItem[];
  backgroundExtras?: () => NContextMenuItem[];

  /** Called for any item-context action id not matched by the standard handlers. */
  onItemExtraAction?: (action: string, target: StorageTarget<T>) => void;
  /** Called for any background-context action id not matched by the standard handlers. */
  onBackgroundExtraAction?: (action: string) => void;

  /** Override or extend the icon used per standard action id. */
  iconOverrides?: Partial<Record<StorageMenuAction, LucideIcon>>;
}

export type StorageMenuAction =
  | 'open' | 'download' | 'rename' | 'cut' | 'copy' | 'paste' | 'move' | 'share' | 'delete'
  | 'new-folder' | 'new-file' | 'select-all';

const DEFAULT_ICONS: Record<StorageMenuAction, LucideIcon> = {
  open: Eye,
  download: Download,
  rename: Pencil,
  cut: Scissors,
  copy: Copy,
  paste: ClipboardPaste,
  move: Move,
  share: Share2,
  delete: Trash2,
  'new-folder': FolderPlus,
  'new-file': FilePlus,
  'select-all': CheckSquare,
};

export interface UseStorageContextMenuResult<T = unknown> {
  /** Attach to an item's `onContextMenu`. */
  openItem: (e: React.MouseEvent, target: StorageTarget<T>) => void;
  /** Attach to the empty area's `onContextMenu`. */
  openBackground: (e: { preventDefault: () => void; clientX: number; clientY: number }) => void;
  close: () => void;
  /** Render this once at the root of your panel. */
  menu: React.ReactNode;
}

/**
 * Reusable right-click menu for storage-like views (files, folders, DB-backed
 * records). The hook owns the menu's open/close + position state and produces a
 * standard set of items based on capability flags. Domain-specific actions can
 * be appended via `itemExtras` / `backgroundExtras`.
 */
export function useStorageContextMenu<T = unknown>(opts: UseStorageContextMenuOptions<T>): UseStorageContextMenuResult<T> {
  const [state, setState] = useState<MenuState<T>>(null);

  const close = useCallback(() => setState(null), []);

  const openItem = useCallback((e: React.MouseEvent, target: StorageTarget<T>) => {
    e.preventDefault();
    e.stopPropagation();
    setState({ x: e.clientX, y: e.clientY, kind: 'item', target });
  }, []);

  const openBackground = useCallback((e: { preventDefault: () => void; clientX: number; clientY: number }) => {
    e.preventDefault();
    setState({ x: e.clientX, y: e.clientY, kind: 'background' });
  }, []);

  const icon = (id: StorageMenuAction): LucideIcon => opts.iconOverrides?.[id] ?? DEFAULT_ICONS[id];

  const items = useMemo<NContextMenuItem[]>(() => {
    if (!state) return [];

    if (state.kind === 'background') {
      const arr: NContextMenuItem[] = [];
      if (opts.canNewFolder) arr.push({ id: 'new-folder', label: 'New folder', icon: icon('new-folder') });
      if (opts.canNewFile)   arr.push({ id: 'new-file',   label: 'New file',   icon: icon('new-file') });
      if (opts.canPaste) {
        arr.push({
          id: 'paste', label: 'Paste', icon: icon('paste'),
          disabled: !opts.hasClipboard, separatorBefore: arr.length > 0,
        });
      }
      if (opts.canSelectAll) arr.push({ id: 'select-all', label: 'Select all', icon: icon('select-all'), separatorBefore: arr.length > 0 });
      if (opts.sortOptions?.length) {
        arr.push({
          id: 'reorganize', label: 'Reorganize', icon: ArrowUpDown,
          separatorBefore: arr.length > 0,
          submenu: opts.sortOptions.map((s) => ({ id: `sort:${s.id}`, label: `${s.label}${s.suffix ?? ''}` })),
        });
      }
      const extras = opts.backgroundExtras?.() ?? [];
      if (extras.length) {
        extras[0] = { ...extras[0], separatorBefore: extras[0].separatorBefore ?? arr.length > 0 };
        arr.push(...extras);
      }
      return arr;
    }

    const { target } = state;
    const isFolder = !!target.isFolder;
    const arr: NContextMenuItem[] = [];

    if (opts.canOpen) arr.push({ id: 'open', label: 'Open', icon: icon('open') });
    if (opts.canDownload && !isFolder) arr.push({ id: 'download', label: 'Download', icon: icon('download') });
    if (opts.canRename) arr.push({ id: 'rename', label: 'Rename', icon: icon('rename') });
    if (opts.canCut)   arr.push({ id: 'cut',  label: 'Cut',  icon: icon('cut'),  separatorBefore: arr.length > 0 });
    if (opts.canCopy)  arr.push({ id: 'copy', label: 'Copy', icon: icon('copy') });
    if (opts.canPaste) arr.push({ id: 'paste', label: 'Paste', icon: icon('paste'), disabled: !opts.hasClipboard });
    if (opts.canMove)  arr.push({ id: 'move', label: 'Move to…', icon: icon('move'), separatorBefore: arr.length > 0 });
    if (opts.canShare && !isFolder) arr.push({ id: 'share', label: 'Share', icon: icon('share'), separatorBefore: arr.length > 0 });

    const extras = opts.itemExtras?.(target) ?? [];
    if (extras.length) {
      extras[0] = { ...extras[0], separatorBefore: extras[0].separatorBefore ?? arr.length > 0 };
      arr.push(...extras);
    }

    if (opts.canDelete) arr.push({ id: 'delete', label: 'Delete', icon: icon('delete'), danger: true, separatorBefore: arr.length > 0 });
    return arr;
  }, [state, opts]);

  const onAction = useCallback((id: string) => {
    if (!state) return;

    if (id.startsWith('sort:')) {
      opts.onSort?.(id.slice('sort:'.length));
      return;
    }

    if (state.kind === 'background') {
      switch (id) {
        case 'new-folder': opts.onNewFolder?.(); return;
        case 'new-file':   opts.onNewFile?.(); return;
        case 'paste':      opts.onPaste?.(); return;
        case 'select-all': opts.onSelectAll?.(); return;
      }
      opts.onBackgroundExtraAction?.(id);
      return;
    }

    const t = state.target;
    switch (id) {
      case 'open':     opts.onOpen?.(t); return;
      case 'download': opts.onDownload?.(t); return;
      case 'rename':   opts.onRename?.(t); return;
      case 'cut':      opts.onCut?.(t); return;
      case 'copy':     opts.onCopy?.(t); return;
      case 'paste':    opts.onPaste?.(); return;
      case 'move':     opts.onMove?.(t); return;
      case 'share':    opts.onShare?.(t); return;
      case 'delete':   opts.onDelete?.(t); return;
    }
    opts.onItemExtraAction?.(id, t);
  }, [state, opts]);

  const menu = state ? (
    <NContextMenu x={state.x} y={state.y} items={items} onAction={onAction} onClose={close} />
  ) : null;

  return { openItem, openBackground, close, menu };
}
