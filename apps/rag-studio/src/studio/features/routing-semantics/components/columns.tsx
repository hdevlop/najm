import React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge, Button } from 'najm-kit';
import { Boxes, Pencil, ShieldCheck, Trash2 } from 'lucide-react';
import type { SemanticPhraseResponse } from '@/features/routing-semantics/types';

export interface SemanticColumnHandlers {
  toolGroupByName: Record<string, string>;
  onEdit: (phrase: SemanticPhraseResponse) => void;
  onDelete: (id: string) => void;
}

function ConfirmBadge({ phrase }: { phrase: SemanticPhraseResponse }) {
  if (!phrase.confirmation) {
    return <Badge variant="outline" className="rounded-md text-xs text-txt-muted">None</Badge>;
  }
  const variant =
    phrase.confirmation.level === 'danger'
      ? 'destructive'
      : phrase.confirmation.level === 'warning'
        ? 'warning'
        : 'outline';
  return (
    <Badge
      variant={variant}
      className="gap-1 rounded-md text-xs capitalize"
      title={phrase.confirmation.resolvedMessage ?? phrase.confirmation.message}
    >
      <ShieldCheck className="h-3 w-3" />
      {phrase.confirmation.level ?? 'notice'}
    </Badge>
  );
}

function EmbeddingStatusBadge({ hasEmbedding }: { hasEmbedding: boolean }) {
  return hasEmbedding ? (
    <Badge variant="success" className="text-xs uppercase">Embedded</Badge>
  ) : (
    <Badge variant="warning" className="text-xs uppercase">Pending</Badge>
  );
}

export function buildSemanticColumns(handlers: SemanticColumnHandlers): ColumnDef<SemanticPhraseResponse, any>[] {
  return [
    {
      accessorKey: 'phrase',
      header: 'Phrase',
      cell: ({ row }) => (
        <span className="text-sm font-medium text-txt-primary">{row.original.phrase}</span>
      ),
    },
    {
      accessorKey: 'toolName',
      header: 'Tool',
      cell: ({ row }) => (
        <Badge variant="outline" className="text-sm font-mono">{row.original.toolName}</Badge>
      ),
    },
    {
      id: 'group',
      header: 'Group',
      size: 140,
      cell: ({ row }) => (
        <Badge variant="outline" className="gap-1 rounded-md text-xs">
          <Boxes className="h-3 w-3" />
          {handlers.toolGroupByName[row.original.toolName] ?? 'default'}
        </Badge>
      ),
    },
    {
      accessorKey: 'lang',
      header: 'Lang',
      size: 80,
      cell: ({ row }) => (
        <span className="text-txt-muted text-sm font-mono uppercase">{row.original.lang}</span>
      ),
    },
    {
      id: 'confirm',
      header: 'Confirm',
      size: 110,
      cell: ({ row }) => <ConfirmBadge phrase={row.original} />,
    },
    {
      id: 'status',
      header: 'Status',
      size: 90,
      cell: ({ row }) => <EmbeddingStatusBadge hasEmbedding={row.original.hasEmbedding} />,
    },
    {
      id: 'actions',
      header: 'Actions',
      size: 100,
      cell: ({ row }) => (
        <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg"
            onClick={() => handlers.onEdit(row.original)}
          >
            <Pencil className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 rounded-lg text-status-red hover:bg-status-red/10"
            onClick={() => handlers.onDelete(row.original.id)}
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
        </div>
      ),
    },
  ];
}
