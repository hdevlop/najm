import React from 'react';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge, Button } from 'najm-ui';
import { Loader2, PencilLine, Play, Trash2 } from 'lucide-react';
import { StatusChip, PendingChip } from './StatusChip';
import type { TestCase, TestResult } from '../types';

export interface TestColumnHandlers {
  results: Record<string, TestResult>;
  runningId: string | null;
  onRun: (test: TestCase) => void;
  onEdit: (test: TestCase) => void;
  onDelete: (test: TestCase) => void;
}

function StatusCell({ test, handlers }: { test: TestCase; handlers: TestColumnHandlers }) {
  const result = handlers.results[test.id] ?? null;
  const isRunning = handlers.runningId === test.id;
  if (isRunning) return <Loader2 className="h-4 w-4 animate-spin text-brand" />;
  if (result) return <StatusChip status={result.status} />;
  return <PendingChip />;
}

function ExpectedToolsCell({ test, handlers }: { test: TestCase; handlers: TestColumnHandlers }) {
  const result = handlers.results[test.id] ?? null;
  return (
    <div className="flex min-w-0 items-center gap-1.5 overflow-hidden">
      {test.expectedTools.map((tool) => (
        <Badge
          key={tool}
          variant={result?.missingTools.includes(tool) ? 'destructive' : 'success'}
          className="max-w-[120px] shrink-0 truncate rounded-md px-2 py-0.5 font-mono text-xs"
          title={tool}
        >
          {tool}
        </Badge>
      ))}
    </div>
  );
}

function ActionsCell({ test, handlers }: { test: TestCase; handlers: TestColumnHandlers }) {
  const isRunning = handlers.runningId === test.id;
  return (
    <div className="flex justify-end gap-1" onClick={(e) => e.stopPropagation()}>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-lg"
        onClick={() => handlers.onRun(test)}
        disabled={isRunning}
      >
        {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-lg"
        onClick={() => handlers.onEdit(test)}
      >
        <PencilLine className="h-3.5 w-3.5" />
      </Button>
      <Button
        variant="ghost"
        size="icon"
        className="h-8 w-8 rounded-lg text-status-red hover:bg-status-red/10"
        onClick={() => handlers.onDelete(test)}
      >
        <Trash2 className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function buildTestColumns(handlers: TestColumnHandlers): ColumnDef<TestCase, any>[] {
  return [
    {
      id: 'status',
      header: 'Status',
      size: 120,
      cell: ({ row }) => <StatusCell test={row.original} handlers={handlers} />,
    },
    {
      accessorKey: 'name',
      header: 'Test Name',
      size: 260,
      cell: ({ row }) => (
        <span className="block truncate font-semibold text-txt-primary" title={row.original.name}>
          {row.original.name}
        </span>
      ),
    },
    {
      accessorKey: 'query',
      header: 'Query',
      cell: ({ row }) => (
        <span className="block truncate text-sm text-txt-secondary" title={row.original.query}>
          {row.original.query}
        </span>
      ),
    },
    {
      id: 'expectedTools',
      header: 'Expected Tools',
      size: 220,
      cell: ({ row }) => <ExpectedToolsCell test={row.original} handlers={handlers} />,
    },
    {
      id: 'actions',
      header: () => <span className="block text-right">Actions</span>,
      size: 120,
      cell: ({ row }) => <ActionsCell test={row.original} handlers={handlers} />,
    },
  ];
}
