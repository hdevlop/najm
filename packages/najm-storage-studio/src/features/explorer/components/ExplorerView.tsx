import { useCallback, useRef, useState, useMemo } from 'react';
import { toast } from 'sonner';
import { Archive, FolderPlus, Trash2, Copy, Share2, Move, Tag, UploadCloud } from 'lucide-react';
import { NPageHeader, NBulkActionsBar, type NBulkAction } from 'najm-ui';

import { useObjects } from '../hooks/useObjects';
import { useSelection } from '../hooks/useSelection';
import { FileBrowser } from './FileBrowser';
import type { SortingState } from '@tanstack/react-table';
import type { SortKey, SortDir, FileItem } from '../types';
import { Breadcrumb } from './Breadcrumb';
import { PreviewSheet } from '../../preview/components/PreviewSheet';
import { FilePropertiesSheet } from '../../preview/components/FilePropertiesSheet';

import { useExplorerMutations } from '../hooks/useExplorerMutations';
import { useExplorerClipboard } from '../hooks/useExplorerClipboard';
import { useExplorerDialogs } from '../hooks/useExplorerDialogs';
import { useExplorerContextMenu } from '../hooks/useExplorerContextMenu';
import { useBackgroundContextMenu } from '../hooks/useBackgroundContextMenu';
import { useUploadManager } from '../hooks/useUploadManager';
import { NConfirmDialog } from 'najm-ui';
import { NewFolderSheet } from './NewFolderSheet';
import { RenameSheet } from './RenameSheet';
import { MoveSheet } from './MoveSheet';
import { UploadSheet } from './UploadSheet';
import { TrashDialog } from '../../trash/components/TrashDialog';

interface Props {
  bucket: string;
  view: 'list' | 'grid';
  onViewChange: (v: 'list' | 'grid') => void;
  prefix: string;
  onPrefixChange: (p: string) => void;
}

export function ExplorerView({ bucket, view, onViewChange, prefix, onPrefixChange }: Props) {
  const rootRef = useRef<HTMLDivElement>(null);

  const { data, mutate, isLoading } = useObjects(bucket, prefix);
  const refresh = useCallback(() => { mutate(); }, [mutate]);
  const { selected, toggle, clear, setAll } = useSelection() as any;

  const [previewFile, setPreviewFile] = useState<FileItem | null>(null);
  const [propertiesFile, setPropertiesFile] = useState<FileItem | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortDir, setSortDir] = useState<SortDir>('asc');
  const sorting = useMemo<SortingState>(
    () => (sortKey ? [{ id: sortKey, desc: sortDir === 'desc' }] : []),
    [sortKey, sortDir],
  );
  const [uploadOpen, setUploadOpen] = useState(false);
  const [trashOpen, setTrashOpen] = useState(false);

  const mutations = useExplorerMutations(bucket, refresh);
  const clipboard = useExplorerClipboard(mutations, prefix);
  const dialogs   = useExplorerDialogs({ prefix, mutations, onClearSelection: clear });
  const uploads   = useUploadManager(bucket, prefix, refresh);

  const openUpload = useCallback(() => setUploadOpen(true), []);

  const files = data?.files ?? [];
  const folders = data?.folders ?? [];
  const cutPaths = useMemo(
    () => clipboard.clipboard?.mode === 'cut' ? new Set(clipboard.clipboard.paths) : undefined,
    [clipboard.clipboard],
  );

  const selectAll = useCallback(() => {
    const keys = [...folders, ...files.map((f) => f.filePath)];
    if (typeof setAll === 'function') setAll(keys);
    else keys.forEach((k) => !selected.has(k) && toggle(k));
  }, [folders, files, setAll, selected, toggle]);

  const onSortChange = useCallback((k: SortKey) => {
    if (sortKey === k) setSortDir(sortDir === 'asc' ? 'desc' : 'asc');
    else { setSortKey(k); setSortDir('asc'); }
  }, [sortKey, sortDir]);

  const handleSortingChange = useCallback((state: SortingState) => {
    const next = state[0];
    if (next) {
      setSortKey(next.id as SortKey);
      setSortDir(next.desc ? 'desc' : 'asc');
    }
  }, []);

  const ctx = useExplorerContextMenu({
    files, selected, dialogs, clipboard, mutations,
    sortKey, sortDir, onSortChange, onSelectAll: selectAll,
    onUploadClick: openUpload,
    view, onViewChange,
    onProperties: (file) => setPropertiesFile(file),
  });

  useBackgroundContextMenu(rootRef, ctx.openBackground);

  const handleNavigate = useCallback((key: string, isFolder: boolean) => {
    if (isFolder) onPrefixChange(key);
    else setPreviewFile(files.find((f) => f.filePath === key) ?? null);
  }, [files, onPrefixChange]);

  const handleDragMove = useCallback(async (sourcePath: string, targetFolder: string) => {
    const name = sourcePath.split('/').pop()!;
    const to = `${targetFolder}${name}`;
    const currentFolder = sourcePath.includes('/')
      ? sourcePath.slice(0, sourcePath.lastIndexOf('/') + 1)
      : '';
    if (to === sourcePath || targetFolder === currentFolder) return;
    try {
      await mutations.move(sourcePath, to);
      refresh();
    } catch (e: any) {
      toast.error(e?.message ?? 'Move failed');
    }
  }, [mutations, refresh]);

  const handleBatchAction = useCallback((action: string) => {
    const paths = Array.from(selected) as string[];
    if (!paths.length) return;
    if (action === 'delete') dialogs.delete.open(paths);
    else if (action === 'move') dialogs.move.open(paths);
  }, [selected, dialogs]);

  return (
    <div ref={rootRef} className="flex h-full flex-col">
      <NPageHeader
        icon={Archive}
        title={bucket ?? 'Bucket Explorer'}
        subtitle="Files and folders"
        actions={
          <>
            <button
              onClick={() => setTrashOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-txt hover:bg-white/10"
              aria-label="Open trash"
              title="Trash"
            >
              <Trash2 size={14} /> Trash
            </button>
            <button
              onClick={dialogs.newFolder.open}
              className="inline-flex items-center gap-1.5 rounded-lg bg-white/5 px-2.5 py-1.5 text-xs text-txt hover:bg-white/10"
              aria-label="Create new folder"
            >
              <FolderPlus size={14} /> New folder
            </button>
            <button
              onClick={openUpload}
              className="inline-flex items-center gap-1.5 rounded-lg bg-brand px-2.5 py-1.5 text-xs text-white hover:bg-brand/90"
              aria-label="Upload files"
            >
              <UploadCloud size={14} /> Upload
            </button>
          </>
        }
        top={
          <div className="border-b border-border px-4 py-2.5 sm:px-5">
            <Breadcrumb prefix={prefix} onNavigate={onPrefixChange} />
          </div>
        }
        footer={
          selected.size > 0 ? (
            <div className="relative h-0 w-full">
              <NBulkActionsBar
                count={selected.size}
                variant="floating"
                onClear={clear}
                onAction={handleBatchAction}
                actions={[
                  { id: 'move',   label: 'Move',   icon: Move } as NBulkAction,
                  { id: 'copy',   label: 'Copy',   icon: Copy } as NBulkAction,
                  { id: 'tag',    label: 'Tag',    icon: Tag } as NBulkAction,
                  { id: 'share',  label: 'Share',  icon: Share2 } as NBulkAction,
                  { id: 'delete', label: 'Delete', icon: Trash2, danger: true } as NBulkAction,
                ]}
              />
            </div>
          ) : undefined
        }
        contentClassName="flex flex-1 overflow-hidden"
      >
        <div className="flex flex-1 overflow-hidden">
          <FileBrowser
            files={files}
            folders={folders}
            namespace={bucket}
            mode={view === 'grid' ? 'cards' : 'table'}
            onModeChange={(m) => onViewChange(m === 'cards' ? 'grid' : 'list')}
            selected={selected}
            onSelectAll={(keys) => {
              if (!keys.length) clear();
              else if (typeof setAll === 'function') setAll(keys);
              else keys.forEach((k) => !selected.has(k) && toggle(k));
            }}
            onNavigate={handleNavigate}
            cutPaths={cutPaths}
            onRowContextMenu={(e, row) => {
              ctx.openItem(e, { key: row.key, isFolder: row.isFolder });
            }}
            onMoveToFolder={handleDragMove}
            loading={isLoading}
            sorting={sorting}
            onSortingChange={handleSortingChange}
          />
        </div>
      </NPageHeader>

      {ctx.menu}
      <PreviewSheet file={previewFile} files={files} onClose={() => setPreviewFile(null)} onNavigate={(f) => setPreviewFile(f)} />
      <FilePropertiesSheet file={propertiesFile} onClose={() => setPropertiesFile(null)} />

      <NewFolderSheet state={dialogs.newFolder.state} prefix={prefix} onChange={dialogs.newFolder.change} onSubmit={dialogs.newFolder.submit} onClose={dialogs.newFolder.close} />
      <RenameSheet    state={dialogs.rename.state}    onChange={dialogs.rename.change}    onSubmit={dialogs.rename.submit}    onClose={dialogs.rename.close} />
      <MoveSheet      state={dialogs.move.state}      onChange={dialogs.move.change}      onSubmit={dialogs.move.submit}      onClose={dialogs.move.close} />
      <NConfirmDialog
        open={!!dialogs.delete.state}
        onOpenChange={(open) => { if (!open && !dialogs.delete.state?.busy) dialogs.delete.close(); }}
        onConfirm={dialogs.delete.submit}
        title={`Delete ${dialogs.delete.state?.paths.length ?? 0} item${(dialogs.delete.state?.paths.length ?? 0) === 1 ? '' : 's'}?`}
        description="Files will be moved to Trash where you can restore them or remove them permanently."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        variant="destructive"
        loading={dialogs.delete.state?.busy ?? false}
      >
        {dialogs.delete.state && (
          <div className="max-h-48 overflow-auto rounded-lg border border-white/5 bg-bg-elev-1 p-2 text-xs text-txt-muted">
            {dialogs.delete.state.paths.map((p) => <div key={p} className="truncate">{p}</div>)}
          </div>
        )}
        {dialogs.delete.state?.error && <p className="mt-2 text-xs text-red-400">{dialogs.delete.state.error}</p>}
      </NConfirmDialog>
      <UploadSheet    open={uploadOpen} onOpenChange={setUploadOpen} prefix={prefix} manager={uploads} />
      <TrashDialog    open={trashOpen}  onOpenChange={setTrashOpen} />
    </div>
  );
}
