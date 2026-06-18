import React from 'react';
import { FunctionSquare, Package } from 'lucide-react';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from 'najm-kit';
import type { MCPTool } from '@/features/routing-tools/types';

function ToolNameCell({ tool }: { tool: MCPTool }) {
  return (
    <div className="flex min-w-0 items-center gap-2">
      <FunctionSquare className="h-4 w-4 shrink-0 text-brand" />
      <span
        className="truncate font-mono text-sm font-semibold text-txt-primary"
        title={tool.name}
      >
        {tool.name}
      </span>
    </div>
  );
}

function GroupCell({ tool }: { tool: MCPTool }) {
  return (
    <Badge
      variant="outline"
      className="rounded-md bg-surface px-2 py-0.5 text-xs font-mono uppercase tracking-wide text-txt-muted ring-border"
    >
      {tool.group}
    </Badge>
  );
}

function ConfirmCell({ tool }: { tool: MCPTool }) {
  if (!tool.confirmation) {
    return (
      <Badge variant="outline" className="rounded-md px-2 py-0.5 text-xs text-txt-muted">
        None
      </Badge>
    );
  }
  const level = tool.confirmation.level;
  return (
    <Badge
      variant={level === 'danger' ? 'destructive' : level === 'warning' ? 'warning' : 'default'}
      className="gap-1 rounded-md px-2 py-0.5 text-xs capitalize"
    >
      {level ?? 'notice'}
    </Badge>
  );
}

function DescriptionCell({ tool }: { tool: MCPTool }) {
  return (
    <div className="max-w-[420px]">
      <p className="truncate text-sm text-txt-secondary" title={tool.description}>
        {tool.description}
      </p>
    </div>
  );
}

function DependenciesCell({ tool }: { tool: MCPTool }) {
  const deps = tool.dependencies ?? [];
  const previewDeps = deps.slice(0, 2);
  const overflow = deps.length - previewDeps.length;

  if (deps.length === 0) {
    return <span className="text-sm text-txt-muted">—</span>;
  }

  return (
    <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
      <Package className="h-3.5 w-3.5 text-status-yellow shrink-0" />
      <span className="text-sm text-txt-secondary">{deps.length}</span>
      {previewDeps.map((d) => (
        <Badge
          key={d}
          variant="outline"
          className="max-w-[150px] shrink-0 truncate rounded-md bg-surface px-2 py-0.5 text-xs font-mono ring-border"
          title={d}
        >
          {d}
        </Badge>
      ))}
      {overflow > 0 && (
        <span className="shrink-0 text-sm text-txt-muted">... +{overflow}</span>
      )}
    </div>
  );
}

export const toolColumns: ColumnDef<MCPTool, any>[] = [
  {
    accessorKey: 'name',
    header: 'Tool Name',
    size: 220,
    cell: ({ row }) => <ToolNameCell tool={row.original} />,
  },
  {
    accessorKey: 'group',
    header: 'Group',
    size: 120,
    cell: ({ row }) => <GroupCell tool={row.original} />,
  },
  {
    id: 'confirmation',
    header: 'Confirm',
    size: 120,
    cell: ({ row }) => <ConfirmCell tool={row.original} />,
  },
  {
    accessorKey: 'description',
    header: 'Description',
    size: 420,
    cell: ({ row }) => <DescriptionCell tool={row.original} />,
  },
  {
    id: 'dependencies',
    header: 'Dependencies',
    size: 220,
    cell: ({ row }) => <DependenciesCell tool={row.original} />,
  },
];
