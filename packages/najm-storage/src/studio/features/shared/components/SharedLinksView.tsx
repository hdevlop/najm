import React, { useState } from 'react';
import { Link, Copy, Trash2, ExternalLink, X } from 'lucide-react';
import { NEmptyState, NTable, Button, NConfirmDialog, NPageHeader } from 'najm-kit';
import { useSharedLinks } from '../hooks/useSharedLinks';
import { formatRelativeTime } from '../../../lib/format';
import type { SharedLink } from '../types';

export function SharedLinksView() {
  const { data, remove, clear } = useSharedLinks();
  const [confirmClear, setConfirmClear] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const handleCopy = async (link: SharedLink) => {
    try {
      await navigator.clipboard.writeText(link.url);
      setCopiedId(link.id);
      setTimeout(() => setCopiedId(null), 1500);
    } catch {
      // ignore
    }
  };

  const columns = React.useMemo<any[]>(() => [
    {
      accessorKey: 'filePath',
      header: 'File',
      cell: ({ row }: any) => {
        const link = row.original as SharedLink;
        return (
          <div className="flex items-center gap-2">
            <span className="font-medium text-txt">{link.filePath.split('/').pop() ?? link.filePath}</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'namespace',
      header: 'Bucket',
      cell: ({ row }: any) => <span className="text-txt-muted">{(row.original as SharedLink).namespace}</span>,
    },
    {
      accessorKey: 'createdAt',
      header: 'Created',
      cell: ({ row }: any) => {
        const link = row.original as SharedLink;
        return <span className="text-txt-muted">{formatRelativeTime(link.createdAt)}</span>;
      },
    },
    {
      accessorKey: 'ttlSeconds',
      header: 'Expires',
      cell: ({ row }: any) => {
        const link = row.original as SharedLink;
        return <span className="text-txt-muted">{Math.floor(link.ttlSeconds / 60)} min</span>;
      },
    },
    {
      id: 'actions',
      header: 'Action',
      enableSorting: false,
      cell: ({ row }: any) => {
        const link = row.original as SharedLink;
        const isCopied = copiedId === link.id;
        return (
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleCopy(link)}
              className="gap-1"
            >
              <Copy size={12} />
              {isCopied ? 'Copied' : 'Copy'}
            </Button>
            <a
              href={link.url}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-medium transition-colors hover:bg-accent hover:text-accent-foreground"
            >
              <ExternalLink size={12} />
              Open
            </a>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => remove(link.id)}
              className="gap-1"
            >
              <X size={12} />
              Remove
            </Button>
          </div>
        );
      },
    },
  ], [copiedId, remove]);

  return (
    <NPageHeader
      icon={Link}
      title="Shared"
      subtitle="Manage presigned shareable links"
      actions={
        data.length > 0 ? (
          <Button variant="outline" size="sm" onClick={() => setConfirmClear(true)} className="gap-1">
            <Trash2 size={12} />
            Clear all
          </Button>
        ) : undefined
      }
    >
      <div className="p-4">
        <NTable<SharedLink, 'table'>
          data={data}
          columns={columns}
          loading={false}
          getRowId={(link) => link.id}
          className="px-0 py-0"
          headerClassName="bg-bg-elev-2"
          classNames={{
            content: 'border-white/15 bg-bg-elev-1 shadow-[0_0_0_1px_rgba(255,255,255,0.04)]',
            tableHeader: '[&_tr]:border-white/15',
            pagination: 'border-t border-white/10 pt-3 text-txt-muted',
            row: 'border-white/10 hover:bg-white/[0.03]',
          }}
          availableModes={['table']}
          mode="table"
          showCheckbox={false}
          showViewToggle={false}
          loadingText="Loading shared links..."
          renderEmpty={() => (
            <NEmptyState
              icon={Link}
              title="No shared links"
              description="Generate shareable URLs from the file explorer and they will appear here."
            />
          )}
        />
      </div>
      <NConfirmDialog
        open={confirmClear}
        onOpenChange={(open) => { if (!open) setConfirmClear(false); }}
        onConfirm={() => { clear(); setConfirmClear(false); }}
        title="Clear all shared links?"
        description="This will remove all tracked shared links from your browser. This action cannot be undone."
        confirmLabel="Clear all"
        cancelLabel="Cancel"
        variant="destructive"
      />
    </NPageHeader>
  );
}
