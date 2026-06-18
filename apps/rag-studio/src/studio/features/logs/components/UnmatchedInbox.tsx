import React, { useMemo, useState } from 'react';
import { Inbox, Loader2, Map, Trash2, RefreshCw } from 'lucide-react';
import { Button, NativeSelect, NPageHeader, NEmptyState, NTable } from 'najm-kit';
import type { ColumnDef } from '@tanstack/react-table';
import type { MCPTool, UnmatchedQuery } from '@/features/logs/types';

export interface UnmatchedInboxProps {
  items: UnmatchedQuery[];
  tools: MCPTool[];
  loading: boolean;
  onRefresh: () => void;
  onMap: (id: string, toolName: string) => Promise<void>;
  onDiscard: (id: string) => Promise<void>;
}

function relativeTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  if (diffMs < 0) return 'just now';

  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function ActionsCell({
  item,
  tools,
  onMap,
  onDiscard,
}: {
  item: UnmatchedQuery;
  tools: MCPTool[];
  onMap: (id: string, toolName: string) => Promise<void>;
  onDiscard: (id: string) => Promise<void>;
}) {
  const [selectedTool, setSelectedTool] = useState('');
  const [mapping, setMapping] = useState(false);
  const [discarding, setDiscarding] = useState(false);

  const handleMap = async () => {
    if (!selectedTool) return;
    setMapping(true);
    try {
      await onMap(item.id, selectedTool);
    } finally {
      setMapping(false);
    }
  };

  const handleDiscard = async () => {
    setDiscarding(true);
    try {
      await onDiscard(item.id);
    } finally {
      setDiscarding(false);
    }
  };

  const busy = mapping || discarding;
  const toolOptions = tools.map((t) => ({ value: t.name, label: t.name }));

  return (
    <div className="flex items-center gap-2">
      <NativeSelect
        options={toolOptions}
        placeholder="Select tool..."
        value={selectedTool}
        onChange={(e) => setSelectedTool(e.target.value)}
        className="h-8 w-[160px] text-xs"
        disabled={busy}
      />
      <Button
        size="sm"
        variant="outline"
        onClick={handleMap}
        disabled={!selectedTool || busy}
        className="h-8 gap-1 px-2"
      >
        {mapping ? <Loader2 className="h-3 w-3 animate-spin" /> : <Map className="h-3 w-3" />}
        <span className="hidden sm:inline">Map</span>
      </Button>
      <Button
        size="sm"
        variant="outline"
        onClick={handleDiscard}
        disabled={busy}
        className="h-8 px-2 text-destructive hover:text-destructive"
      >
        {discarding ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
      </Button>
    </div>
  );
}

export function UnmatchedInbox({ items, tools, loading, onRefresh, onMap, onDiscard }: UnmatchedInboxProps) {
  const columns = useMemo<ColumnDef<UnmatchedQuery, any>[]>(() => [
    {
      accessorKey: 'query',
      header: 'Query',
      cell: ({ row }) => (
        <div className="max-w-[280px]">
          <p className="truncate text-sm text-foreground">{row.original.query}</p>
          <p className="truncate text-xs text-muted-foreground">{row.original.normalized}</p>
        </div>
      ),
    },
    {
      accessorKey: 'score',
      header: 'Score',
      size: 120,
      cell: ({ row }) => (
        <span className="whitespace-nowrap font-mono text-xs text-muted-foreground">
          {row.original.score.toFixed(2)} / {row.original.threshold.toFixed(2)}
        </span>
      ),
    },
    {
      accessorKey: 'source',
      header: 'Source',
      size: 120,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{row.original.source ?? 'unknown'}</span>
      ),
    },
    {
      accessorKey: 'occurrenceCount',
      header: 'Occurrences',
      size: 120,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{row.original.occurrenceCount}</span>
      ),
    },
    {
      accessorKey: 'updatedAt',
      header: 'Updated',
      size: 120,
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {relativeTime(row.original.updatedAt)}
        </span>
      ),
    },
    {
      id: 'actions',
      header: 'Actions',
      size: 340,
      enableSorting: false,
      cell: ({ row }) => (
        <ActionsCell item={row.original} tools={tools} onMap={onMap} onDiscard={onDiscard} />
      ),
    },
  ], [tools, onMap, onDiscard]);

  return (
    <NPageHeader
      icon={Inbox}
      title="Unmatched Queries"
      subtitle={`${items.length} item${items.length !== 1 ? 's' : ''}`}
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={onRefresh}
          disabled={loading}
          className="gap-1.5 px-2"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      }
    >
      <NTable<UnmatchedQuery, 'table'>
        data={items}
        columns={columns}
        loading={loading}
        getRowId={(item) => item.id}
        availableModes={['table']}
        mode="table"
        showCheckbox={false}
        showViewToggle={false}
        loadingText="Loading unmatched queries..."
        renderEmpty={() => (
          <NEmptyState
            icon={Inbox}
            title="No unmatched queries"
            description="Queries that didn't match any tool will appear here for manual mapping."
          />
        )}
      />
    </NPageHeader>
  );
}
