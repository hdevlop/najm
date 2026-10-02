import React, { useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { RefreshCw, ScrollText } from 'lucide-react';
import { Button, Badge, NPageHeader, NEmptyState, NTable } from 'najm-kit';
import type { ColumnDef } from '@tanstack/react-table';
import { useApiClient } from '@/lib/api';
import type { AuditLogEntry } from '@/features/logs/types';

const QUERY_KEY = ['rag-studio', 'audit-logs'] as const;

function actionBadgeVariant(action: string): 'success' | 'destructive' | 'default' | 'warning' | 'secondary' {
  if (action.startsWith('create_')) return 'success';
  if (action.startsWith('delete_')) return 'destructive';
  if (action.startsWith('update_')) return 'default';
  if (action.startsWith('import_')) return 'warning';
  return 'secondary';
}

function relativeTime(dateStr: string): string {
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
  if (days < 30) return `${days}d ago`;

  return new Date(dateStr).toLocaleDateString();
}

export function LogsWorkspace() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: QUERY_KEY,
    queryFn: () => apiClient.get<AuditLogEntry[]>('/settings/audit'),
  });

  const refresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: QUERY_KEY });
  }, [queryClient]);

  const logs = query.data ?? [];

  const columns = useMemo<ColumnDef<AuditLogEntry, any>[]>(() => [
    {
      accessorKey: 'action',
      header: 'Action',
      size: 180,
      cell: ({ row }) => (
        <Badge variant={actionBadgeVariant(row.original.action)} className="text-[11px]">
          {row.original.action}
        </Badge>
      ),
    },
    {
      accessorKey: 'details',
      header: 'Details',
      cell: ({ row }) => (
        <span className="block max-w-[420px] truncate font-mono text-xs text-muted-foreground" title={row.original.details}>
          {row.original.details}
        </span>
      ),
    },
    {
      accessorKey: 'userId',
      header: 'User',
      size: 160,
      cell: ({ row }) => (
        <span className="text-xs text-muted-foreground">{row.original.userId ?? 'system'}</span>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: 'Time',
      size: 140,
      cell: ({ row }) => (
        <span className="whitespace-nowrap text-xs text-muted-foreground">
          {relativeTime(row.original.createdAt)}
        </span>
      ),
    },
  ], []);

  return (
    <NPageHeader
      icon={ScrollText}
      title="Audit Logs"
      subtitle={`${logs.length} log${logs.length !== 1 ? 's' : ''}`}
      actions={
        <Button
          variant="outline"
          size="sm"
          onClick={refresh}
          disabled={query.isFetching}
          className="gap-1.5 px-2"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Refresh</span>
        </Button>
      }
    >
      <NTable<AuditLogEntry, 'table'>
        data={logs}
        columns={columns}
        loading={query.isLoading}
        getRowId={(log) => String(log.id)}
        availableModes={['table']}
        mode="table"
        showCheckbox={false}
        showViewToggle={false}
        loadingText="Loading audit logs..."
        renderEmpty={() => (
          <NEmptyState
            icon={ScrollText}
            title="No audit logs"
            description="Audit log entries will appear here as actions are performed."
          />
        )}
      />
    </NPageHeader>
  );
}
