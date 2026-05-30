import React from 'react';
import { Upload, RefreshCw, Trash2, MoreHorizontal, FileText, FileCode, AlertCircle, CheckCircle2, Loader2, File } from 'lucide-react';
import { Badge, Button, DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, NTable, NEmptyState } from 'najm-ui';
import { NPageHeader } from 'najm-ui';
import type { ColumnDef } from '@tanstack/react-table';
import type { DocumentListItem } from '@/features/knowledge/types';

interface DocumentListProps {
  documents: DocumentListItem[];
  loading: boolean;
  onUpload: () => void;
  onReindex: (id: string) => void;
  onDelete: (id: string) => void;
  onInspect: (id: string) => void;
}

const statusConfig = (status: DocumentListItem['status']) => {
  switch (status) {
    case 'ready':
      return { variant: 'success' as const, icon: <CheckCircle2 className="h-3.5 w-3.5" />, label: 'Ready' };
    case 'extracting':
      return { variant: 'warning' as const, icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, label: 'Extracting' };
    case 'pending':
      return { variant: 'warning' as const, icon: <Loader2 className="h-3.5 w-3.5 animate-spin" />, label: 'Pending' };
    case 'failed':
      return { variant: 'destructive' as const, icon: <AlertCircle className="h-3.5 w-3.5" />, label: 'Failed' };
    default:
      return { variant: 'default' as const, icon: <File className="h-3.5 w-3.5" />, label: status };
  }
};

const sourceIcon = (type: string) => {
  switch (type.toLowerCase()) {
    case 'pdf':
      return <FileText className="h-4 w-4 text-status-red" />;
    case 'markdown':
    case 'md':
      return <FileCode className="h-4 w-4 text-status-yellow" />;
    case 'text':
    case 'txt':
      return <FileText className="h-4 w-4 text-txt-muted" />;
    default:
      return <File className="h-4 w-4 text-txt-muted" />;
  }
};

export function DocumentList({ documents, loading, onUpload, onReindex, onDelete, onInspect }: DocumentListProps) {
  const columns = React.useMemo<ColumnDef<DocumentListItem, any>[]>(() => [
    {
      accessorKey: 'sourceType',
      header: 'Document',
      cell: ({ row }) => {
        const doc = row.original;
        return (
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 rounded-lg bg-card border border-border flex items-center justify-center shrink-0 group-hover:border-txt-muted/30 transition-colors">
              {sourceIcon(doc.sourceType)}
            </div>
            <div>
              <p className="text-sm font-medium text-txt-primary">{`${doc.sourceType.toUpperCase()} Document`}</p>
              <p className="text-sm text-txt-muted">{doc.id.slice(0, 8)}...</p>
            </div>
          </div>
        );
      },
    },
    {
      accessorKey: 'status',
      header: 'Status',
      size: 120,
      cell: ({ row }) => {
        const status = statusConfig(row.original.status);
        return (
          <Badge variant={status.variant} className="gap-1.5">
            {status.icon}
            {status.label}
          </Badge>
        );
      },
    },
    {
      accessorKey: 'chunkCount',
      header: 'Chunks',
      size: 100,
      cell: ({ row }) => (
        <span className="text-txt-secondary font-mono text-sm">{row.original.chunkCount}</span>
      ),
    },
    {
      accessorKey: 'ingestedAt',
      header: 'Ingested',
      size: 140,
      cell: ({ row }) => (
        <span className="text-txt-muted text-sm">
          {row.original.ingestedAt ? new Date(row.original.ingestedAt).toLocaleDateString() : '—'}
        </span>
      ),
    },
    {
      id: 'actions',
      header: '',
      size: 60,
      enableSorting: false,
      cell: ({ row }) => {
        const doc = row.original;
        return (
          <div onClick={(e) => e.stopPropagation()}>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity">
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={() => onReindex(doc.id)} className="gap-2 text-sm">
                  <RefreshCw className="h-3.5 w-3.5" />
                  Reindex
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onDelete(doc.id)} className="gap-2 text-sm text-status-red focus:text-status-red">
                  <Trash2 className="h-3.5 w-3.5" />
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        );
      },
    },
  ], [onReindex, onDelete]);

  return (
    <NPageHeader
      icon={FileText}
      title="Documents"
      subtitle={`${documents.length} document${documents.length !== 1 ? 's' : ''} in knowledge base`}
      actions={
        <Button onClick={onUpload} className="gap-1.5 px-2">
          <Upload className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Upload</span>
        </Button>
      }
      contentClassName="flex-1 overflow-auto p-5"
    >
      <NTable<DocumentListItem, 'table'>
        data={documents}
        columns={columns}
        loading={loading && documents.length === 0}
        getRowId={(doc) => doc.id}
        availableModes={['table']}
        mode="table"
        showCheckbox={false}
        showViewToggle={false}
        onRowClick={(doc) => onInspect(doc.id)}
        classNames={{ row: 'cursor-pointer group' }}
        loadingText="Loading documents..."
        renderEmpty={() => (
          <div className="flex flex-col items-center justify-center h-full text-txt-muted">
            <div className="h-14 w-14 rounded-2xl bg-card border border-border flex items-center justify-center mb-4">
              <Upload className="h-7 w-7 opacity-40" />
            </div>
            <p className="text-sm font-medium text-txt-secondary">No documents uploaded yet</p>
            <p className="text-sm mt-1 text-txt-muted">Upload PDFs, text, or markdown files to get started</p>
            <Button onClick={onUpload} className="mt-4 gap-1.5">
              <Upload className="h-3.5 w-3.5" />
              Upload Document
            </Button>
          </div>
        )}
      />
    </NPageHeader>
  );
}
