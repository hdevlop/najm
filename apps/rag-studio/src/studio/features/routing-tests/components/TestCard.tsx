import React from 'react';
import type { Row } from '@tanstack/react-table';
import { Badge, Button, NDataCardShell } from 'najm-kit';
import { Loader2, PencilLine, Play, Trash2 } from 'lucide-react';
import { StatusChip, PendingChip } from './StatusChip';
import type { TestCase, TestResult } from '../types';

export interface TestCardContext {
  results: Record<string, TestResult>;
  runningId: string | null;
  onRun: (test: TestCase) => void;
  onEdit: (test: TestCase) => void;
  onDelete: (test: TestCase) => void;
}

export function makeTestCard(ctx: TestCardContext) {
  return function TestCard({
    data,
    row,
    onClick,
    onContextMenu,
    isExpanded,
    onToggleExpanded,
    canExpand,
    renderSubRow,
  }: {
    data: TestCase;
    row: Row<TestCase>;
    onClick?: () => void;
    onContextMenu?: (e: React.MouseEvent) => void;
    isExpanded?: boolean;
    onToggleExpanded?: () => void;
    canExpand?: boolean;
    renderSubRow?: (row: TestCase) => React.ReactNode;
  }) {
    const test = data;
    const result = ctx.results[test.id] ?? null;
    const isRunning = ctx.runningId === test.id;

    const stopAnd = (fn: () => void) => (e: React.MouseEvent) => {
      e.stopPropagation();
      fn();
    };

    return (
      <NDataCardShell row={row as unknown as Row<unknown>} onClick={onClick} onContextMenu={onContextMenu}>
        <div className="w-full text-left">
          <div className="mb-2 flex items-center gap-2">
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin text-brand" />
            ) : result ? (
              <StatusChip status={result.status} />
            ) : (
              <PendingChip />
            )}
          </div>
          <p className="break-words text-sm font-semibold leading-relaxed text-txt-primary">{test.name}</p>
          <p className="mt-1 line-clamp-3 break-words text-xs leading-relaxed text-txt-muted">{test.query}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            {test.expectedTools.slice(0, 3).map((tool) => (
              <Badge
                key={tool}
                variant={result?.missingTools.includes(tool) ? 'destructive' : 'success'}
                className="max-w-full truncate rounded-md px-2 py-0.5 font-mono text-[10px]"
                title={tool}
              >
                {tool}
              </Badge>
            ))}
            {test.expectedTools.length > 3 && (
              <span className="text-xs text-txt-muted">+{test.expectedTools.length - 3}</span>
            )}
          </div>
          <div className="mt-3 flex items-center justify-end gap-1 border-t border-border pt-2">
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={stopAnd(() => ctx.onRun(test))}
              disabled={isRunning}
              aria-label={`Run ${test.name}`}
            >
              {isRunning ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg"
              onClick={stopAnd(() => ctx.onEdit(test))}
              aria-label={`Edit ${test.name}`}
            >
              <PencilLine className="h-3.5 w-3.5" />
            </Button>
            <Button
              variant="ghost"
              size="icon"
              className="h-8 w-8 rounded-lg text-status-red hover:bg-status-red/10"
              onClick={stopAnd(() => ctx.onDelete(test))}
              aria-label={`Delete ${test.name}`}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
          {isExpanded && renderSubRow && (
            <div data-testid={`subrow-${test.id}`} className="mt-3 border-t pt-3">
              {renderSubRow(test)}
            </div>
          )}
        </div>
      </NDataCardShell>
    );
  };
}
