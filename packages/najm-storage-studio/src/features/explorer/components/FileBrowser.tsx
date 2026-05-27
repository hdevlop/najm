import React, { useMemo, useCallback } from 'react';
import { Archive } from 'lucide-react';
import { NFileBrowser, NTableCardRoot, Badge, NEmptyState, buildDefaultFileColumns, formatFileBytes, cn } from 'najm-ui';
import type { ColumnDef, Row, SortingState } from '@tanstack/react-table';
import type { FileNode } from 'najm-ui';
import { FileThumbnail, FolderThumbnail } from './FileThumbnail';
import type { FileItem } from '../types';
import { useDragMove } from '../hooks/useDragMove';

export type FileRow = FileNode & {
  url?: string;
  tags?: string[];
  isCut?: boolean;
};

export interface FileBrowserProps {
  files: FileItem[];
  folders: string[];
  mode: 'table' | 'cards';
  onModeChange?: (mode: 'table' | 'cards') => void;
  selected: Set<string>;
  onSelectAll: (keys: string[]) => void;
  onNavigate: (key: string, isFolder: boolean) => void;
  onRowContextMenu: (e: React.MouseEvent, row: FileRow) => void;
  onBackgroundContextMenu?: (e: React.MouseEvent) => void;
  onMoveToFolder: (sourcePath: string, targetFolder: string) => void;
  cutPaths?: Set<string>;
  loading?: boolean;
  sorting?: SortingState;
  onSortingChange?: (state: SortingState) => void;
}

export function FileBrowser({
  files,
  folders,
  mode,
  onModeChange,
  selected,
  onSelectAll,
  onNavigate,
  onRowContextMenu,
  onBackgroundContextMenu,
  onMoveToFolder,
  cutPaths,
  loading,
  sorting,
  onSortingChange,
}: FileBrowserProps) {
  const { dropTarget, dragHandlers } = useDragMove(onMoveToFolder);

  const nodes = useMemo<FileRow[]>(() => [
    ...folders.map((f) => ({
      key: f,
      name: f.split('/').filter(Boolean).pop() ?? f,
      isFolder: true,
      isCut: cutPaths?.has(f) ?? false,
    })),
    ...files.map((f) => ({
      key: f.filePath,
      name: f.filePath.split('/').pop() ?? f.filePath,
      isFolder: false,
      mimeType: f.mimeType,
      size: f.size,
      updatedAt: f.updatedAt,
      url: f.url,
      tags: f.tags,
      isCut: cutPaths?.has(f.filePath) ?? false,
    })),
  ], [files, folders, cutPaths]);

  const renderThumb = useCallback(({ node, size }: { node: FileNode; size: 'sm' | 'xl' }) => {
    const row = node as FileRow;
    return row.isFolder
      ? <FolderThumbnail size={size} />
      : <FileThumbnail mimeType={row.mimeType ?? ''} url={row.url} fileName={row.name} size={size} />;
  }, []);

  const columns = useMemo<ColumnDef<FileNode>[]>(() => {
    const defaults = buildDefaultFileColumns({ renderThumb });
    const dragAwareName: ColumnDef<FileNode> = {
      ...defaults[0],
      cell: ({ row }) => {
        const item = row.original as FileRow;
        const isDropTarget = item.isFolder && dropTarget === item.key;
        const dh = dragHandlers(item);
        return (
          <div
            draggable={dh.draggable}
            onDragStart={dh.onDragStart}
            onDragEnd={dh.onDragEnd}
            onDragOver={dh.onDragOver}
            onDragLeave={dh.onDragLeave}
            onDrop={dh.onDrop}
            className={cn(
              'flex items-center gap-2 rounded-md px-1 py-1',
              isDropTarget && 'bg-brand/10 outline outline-1 outline-brand/40',
              item.isCut && 'opacity-50 grayscale saturate-50',
            )}
          >
            {renderThumb({ node: item, size: 'sm' })}
            <span className="font-medium text-txt">{item.name}</span>
          </div>
        );
      },
    };
    const tagsColumn: ColumnDef<FileNode> = {
      accessorKey: 'tags',
      header: 'Tags',
      enableSorting: false,
      cell: ({ row }) => {
        const item = row.original as FileRow;
        return (
          <div className="flex gap-1">
            {(item.tags ?? []).slice(0, 2).map((tag) => (
              <Badge key={tag} variant="secondary" className="text-[10px] font-normal">
                {tag}
              </Badge>
            ))}
          </div>
        );
      },
    };
    return [dragAwareName, ...defaults.slice(1), tagsColumn];
  }, [renderThumb, dropTarget, dragHandlers]);

  const FileTile = useCallback(({
    data,
    row,
    onClick,
    onContextMenu,
  }: {
    data: FileNode;
    row: Row<FileNode>;
    onClick?: () => void;
    onContextMenu?: (e: React.MouseEvent) => void;
  }) => {
    const item = data as FileRow;
    const isSel = row.getIsSelected();
    const isDropTarget = item.isFolder && dropTarget === item.key;
    const dh = dragHandlers(item);
    return (
      <NTableCardRoot
        card={{ onClick, onContextMenu }}
        draggable={dh.draggable}
        onDragStart={dh.onDragStart}
        onDragEnd={dh.onDragEnd}
        onDragOver={dh.onDragOver}
        onDragLeave={dh.onDragLeave}
        onDrop={dh.onDrop}
        className={cn(
          'group relative flex w-36 cursor-pointer flex-col items-center justify-start gap-2 rounded-xl border border-transparent p-4 transition-colors',
          'hover:bg-bg-elev-1 hover:border-white/10',
          isSel && 'bg-brand/10 border-brand/40',
          isDropTarget && 'outline outline-1 outline-brand/40 bg-brand/10',
          item.isCut && 'opacity-50 grayscale saturate-50',
        )}
      >
        <div className="relative flex h-20 w-20 items-end justify-center">
          {renderThumb({ node: item, size: 'xl' })}
          <input
            type="checkbox"
            checked={isSel}
            onChange={(e) => { e.stopPropagation(); row.toggleSelected(!!e.target.checked); }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              'absolute left-0 top-0 rounded border-white/20 bg-bg transition-opacity',
              isSel ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
            )}
            aria-label={`Select ${item.name}`}
          />
        </div>
        <div className="flex w-full flex-col items-center text-center">
          <span className="max-w-full truncate text-xs font-semibold text-txt">{item.name}</span>
          <span className="mt-0.5 text-[10px] text-txt-muted">
            {item.isFolder ? 'Folder' : formatFileBytes(item.size ?? 0)}
          </span>
        </div>
      </NTableCardRoot>
    );
  }, [dropTarget, dragHandlers, renderThumb]);

  return (
    <div className="flex h-full min-h-full w-full flex-col px-4">
      <NFileBrowser
        nodes={nodes}
        mode={mode}
        onModeChange={onModeChange}
        availableModes={['table', 'cards']}
        showViewToggle={false}
        responsiveCards={false}
        renderThumb={renderThumb}
        columns={columns}
        renderCard={FileTile}
        selected={selected}
        onSelectionChange={onSelectAll}
        onOpen={(n) => onNavigate(n.key, n.isFolder)}
        onContextMenu={(e, n) => onRowContextMenu(e, n as FileRow)}
        onBackgroundContextMenu={onBackgroundContextMenu}
        loading={loading}
        sorting={sorting}
        onSortingChange={onSortingChange}
        noDataText="No files or folders"
        renderEmpty={() => (
          <NEmptyState
            icon={Archive}
            title="No files or folders"
            description="Upload files or create a folder to get started"
          />
        )}
      />
    </div>
  );
}
