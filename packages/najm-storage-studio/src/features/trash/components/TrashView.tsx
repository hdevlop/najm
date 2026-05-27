import React, { useState } from 'react';
import { Trash2, RotateCcw, X } from 'lucide-react';
import { NEmptyState, NConfirmDialog, useContextMenu, Button, NTable } from 'najm-ui';
import { useTrash } from '../hooks/useTrash';
import { useApiClient } from '../../../lib/api';
import { formatBytes, formatRelativeTime } from '../../../lib/format';
import { FileThumbnail } from '../../explorer/components/FileThumbnail';
import type { FileInfo } from '../types';

export function TrashView() {
  const { data, error, isLoading, mutate } = useTrash();
  const api = useApiClient();
  const [restoring, setRestoring] = useState<Set<string>>(new Set());
  const [removing, setRemoving] = useState<Set<string>>(new Set());
  const [confirmRemove, setConfirmRemove] = useState<FileInfo | null>(null);
  const ctx = useContextMenu();

  const handleRestore = async (file: FileInfo) => {
    const key = `${file.namespace}/${file.filePath}`;
    setRestoring((prev) => new Set(prev).add(key));
    try {
      await api.post('/trash/restore', { namespace: file.namespace, path: file.filePath });
      await mutate();
    } finally {
      setRestoring((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const handleRemove = async () => {
    if (!confirmRemove) return;
    const file = confirmRemove;
    const key = `${file.namespace}/${file.filePath}`;
    setRemoving((prev) => new Set(prev).add(key));
    try {
      const encoded = file.filePath.split('/').map(encodeURIComponent).join('/');
      await api.delete(`/${encodeURIComponent(file.namespace)}/files/${encoded}?hard=true`);
      await mutate();
      setConfirmRemove(null);
    } finally {
      setRemoving((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    }
  };

  const removeBusy = confirmRemove
    ? removing.has(`${confirmRemove.namespace}/${confirmRemove.filePath}`)
    : false;

  const columns = React.useMemo<any[]>(() => [
    {
      accessorKey: 'filePath',
      header: 'Name',
      cell: ({ row }: any) => {
        const file = row.original as FileInfo;
        return (
          <div className="flex items-center gap-2">
            <FileThumbnail mimeType={file.mimeType} url={file.url} fileName={file.filePath} size="sm" />
            <span className="font-medium text-txt">{file.filePath.split('/').pop() ?? file.filePath}</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'namespace',
      header: 'Bucket',
      cell: ({ row }: any) => <span className="text-txt-muted">{(row.original as FileInfo).namespace}</span>,
    },
    {
      accessorKey: 'size',
      header: 'Size',
      cell: ({ row }: any) => <span className="text-txt-muted">{formatBytes((row.original as FileInfo).size)}</span>,
    },
    {
      accessorKey: 'deletedAt',
      header: 'Deleted',
      cell: ({ row }: any) => {
        const file = row.original as FileInfo;
        return <span className="text-txt-muted">{file.deletedAt ? formatRelativeTime(file.deletedAt) : '-'}</span>;
      },
    },
    {
      id: 'actions',
      header: 'Action',
      enableSorting: false,
      cell: ({ row }: any) => {
        const file = row.original as FileInfo;
        const key = `${file.namespace}/${file.filePath}`;
        const isRestoring = restoring.has(key);
        const isRemoving = removing.has(key);
        return (
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleRestore(file)}
              disabled={isRestoring || isRemoving}
              className="gap-1"
            >
              <RotateCcw size={12} />
              {isRestoring ? 'Restoring...' : 'Restore'}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmRemove(file)}
              disabled={isRestoring || isRemoving}
              className="gap-1"
            >
              <X size={12} />
              {isRemoving ? 'Removing...' : 'Delete forever'}
            </Button>
          </div>
        );
      },
    },
  ], [removing, restoring]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex-1 min-h-0 overflow-auto">
        <NTable<FileInfo, 'table'>
          data={data ?? []}
          columns={columns}
          loading={isLoading}
          error={error}
          getRowId={(file) => `${file.namespace}/${file.filePath}`}
          availableModes={['table']}
          mode="table"
          showCheckbox={false}
          showViewToggle={false}
          loadingText="Loading trash..."
          renderEmpty={() => <NEmptyState icon={Trash2} title="Trash is empty" description="Deleted files will appear here." />}
          renderError={(err) => <NEmptyState icon={Trash2} title="Error" description={err?.message ?? 'Failed to load trash.'} />}
          onRowContextMenu={(e, file) => ctx.open(e, [
            { label: 'Restore', icon: RotateCcw, onSelect: () => void handleRestore(file) },
            { label: 'Delete forever', icon: X, danger: true, separatorBefore: true, onSelect: () => setConfirmRemove(file) },
          ])}
        />
      </div>
      {!!data?.length && (
        <div className="mt-2 px-1 text-[10px] text-txt-muted">
          Soft-deleted files remain here until permanently removed or restored.
        </div>
      )}
      {ctx.menu}
      <NConfirmDialog
        open={!!confirmRemove}
        onOpenChange={(open) => { if (!open) setConfirmRemove(null); }}
        onConfirm={handleRemove}
        title="Delete file permanently?"
        description={confirmRemove ? `This will permanently delete "${confirmRemove.filePath}". This action cannot be undone.` : 'This action cannot be undone.'}
        confirmLabel="Yes, delete"
        cancelLabel="Cancel"
        variant="destructive"
        loading={removeBusy}
      />
    </div>
  );
}
