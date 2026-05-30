import React from 'react';
import { CheckCircle2, Copy, Folder, Move, Settings, Trash2 } from 'lucide-react';
import { formatRelativeTime } from '../../../lib/format';
import { NEmptyState as EmptyState, NTable } from 'najm-ui';
import type { ActivityRow, RecentActivityTableProps } from '../types';

const icons: Record<string, React.ElementType> = {
  uploaded: CheckCircle2,
  deleted: Trash2,
  'hard-delete': Trash2,
  policy: Settings,
  'folder-created': Folder,
  move: Move,
  copy: Copy,
};

const colors: Record<string, string> = {
  uploaded: 'text-[#0fd69a]',
  deleted: 'text-[#ff4164]',
  'hard-delete': 'text-[#ff4164]',
  policy: 'text-[#4a8dff]',
  'folder-created': 'text-[#f4b000]',
  move: 'text-[#a855f7]',
  copy: 'text-[#22d3ee]',
};

const labels: Record<string, string> = {
  uploaded: 'File Uploaded',
  deleted: 'File Deleted',
  'hard-delete': 'File Deleted',
  policy: 'Policy Updated',
  'folder-created': 'Folder Created',
  move: 'File Moved',
  copy: 'File Copied',
};

function ActivityCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="h-full min-h-0 overflow-hidden rounded-[10px] border border-white/10 bg-[#101012] shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
      {children}
    </div>
  );
}

function formatActionLabel(action: string): string {
  return labels[action] ?? action
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function formatResource(row: ActivityRow): string {
  if (row.path) return `/${row.namespace}/${row.path}`.replace(/\/+/g, '/');
  return row.namespace;
}

export function RecentActivityTable({ rows, loading, error }: RecentActivityTableProps) {
  const columns = React.useMemo<any[]>(() => [
    {
      accessorKey: 'action',
      header: 'Event',
      cell: ({ row }: any) => {
        const activity = row.original as ActivityRow;
        const Icon = icons[activity.action] ?? CheckCircle2;
        const color = colors[activity.action] ?? 'text-txt-muted';
        return (
          <div className="flex min-w-0 items-center gap-2.5">
            <Icon size={14} strokeWidth={2.2} className={color} />
            <span className="truncate text-[13px] font-semibold text-white">{formatActionLabel(activity.action)}</span>
          </div>
        );
      },
    },
    {
      accessorKey: 'path',
      header: 'Resource',
      cell: ({ row }: any) => (
        <span className="block truncate text-[12px] font-medium text-[#b9ceff]">
          {formatResource(row.original as ActivityRow)}
        </span>
      ),
    },
    {
      accessorKey: 'ts',
      header: 'Time',
      cell: ({ row }: any) => (
        <span className="block whitespace-nowrap text-right text-[12px] text-[#8993a5]">
          {formatRelativeTime((row.original as ActivityRow).ts)}
        </span>
      ),
    },
  ], []);

  return (
    <ActivityCard>
      <div className="border-b border-white/[0.06] px-4 py-3">
        <div className="text-sm font-bold text-txt">Recent Activity</div>
      </div>
      <NTable<ActivityRow, 'table'>
        data={rows}
        columns={columns}
        loading={loading}
        error={error}
        getRowId={(row) => String(row.id)}
        availableModes={['table']}
        mode="table"
        showCheckbox={false}
        showViewToggle={false}
        showPagination={false}
        showSorting={false}
        dynamicHeight={false}
        loadingText="Loading activity..."
        className="h-full px-0 py-0"
        classNames={{ content: 'border-0' }}
        renderEmpty={() => (
          <EmptyState
            icon={CheckCircle2}
            title="No recent activity"
            description="Actions will appear here once files are modified."
            className="h-full min-h-[260px]"
          />
        )}
      />
    </ActivityCard>
  );
}
