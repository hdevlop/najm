import React from 'react';
import { Badge } from 'najm-ui';
import { Layers } from 'lucide-react';
import { NEmptyState, NPageHeader, NTable } from 'najm-ui';
import type { ColumnDef } from '@tanstack/react-table';
import type { DocumentChunkResponse } from '@/features/knowledge/types';

interface ChunkTableProps {
  chunks: DocumentChunkResponse[];
  loading: boolean;
  onChunkClick?: (chunkId: string, documentId: string) => void;
}

const PAGE_SIZE = 20;

export function ChunkTable({ chunks, loading, onChunkClick }: ChunkTableProps) {
  const columns = React.useMemo<ColumnDef<DocumentChunkResponse, any>[]>(() => [
    {
      accessorKey: 'ordinal',
      header: '#',
      size: 60,
      cell: ({ row }) => (
        <span className="text-sm text-txt-muted font-mono">{row.original.ordinal + 1}</span>
      ),
    },
    {
      accessorKey: 'page',
      header: 'Page',
      size: 80,
      cell: ({ row }) =>
        row.original.page !== null ? (
          <Badge variant="outline" className="text-sm font-mono">p.{row.original.page + 1}</Badge>
        ) : (
          <span className="text-txt-muted text-sm">—</span>
        ),
    },
    {
      accessorKey: 'text',
      header: 'Text Preview',
      enableSorting: false,
      cell: ({ row }) => (
        <p className="text-sm text-txt-secondary truncate group-hover:text-txt-primary transition-colors max-w-[320px]">
          {row.original.text}
        </p>
      ),
    },
    {
      accessorKey: 'tokens',
      header: 'Tokens',
      size: 90,
      cell: ({ row }) => (
        <span className="text-sm text-txt-muted font-mono">{row.original.tokens}</span>
      ),
    },
    {
      accessorKey: 'enabled',
      header: 'Status',
      size: 80,
      cell: ({ row }) => (
        <Badge
          variant={row.original.enabled ? 'success' : 'destructive'}
          className="text-xs uppercase"
        >
          {row.original.enabled ? 'Active' : 'Off'}
        </Badge>
      ),
    },
  ], []);

  return (
    <NPageHeader
      icon={Layers}
      title="Chunks"
      subtitle={`${chunks.length} total chunks in knowledge base`}
      contentClassName="flex-1 overflow-auto p-5"
    >
      <NTable<DocumentChunkResponse, 'table'>
        data={chunks}
        columns={columns}
        loading={loading}
        getRowId={(c) => c.id}
        availableModes={['table']}
        mode="table"
        showCheckbox={false}
        showViewToggle={false}
        defaultPagination={{ pageIndex: 0, pageSize: PAGE_SIZE }}
        onRowClick={onChunkClick ? (c) => onChunkClick(c.id, c.documentId) : undefined}
        classNames={{ row: 'cursor-pointer group' }}
        loadingText="Loading chunks..."
        renderEmpty={() => (
          <NEmptyState
            icon={Layers}
            title="No chunks found"
            description="Upload documents to create chunks"
          />
        )}
      />
    </NPageHeader>
  );
}
