import React, { useMemo } from 'react';
import { NTable, NEmptyState } from 'najm-kit';
import type { RowSelectionState } from '@tanstack/react-table';
import { buildTestColumns } from '@/features/routing-tests/components/columns';
import type { TestCase, TestResult } from '@/features/routing-tests/types';
import type { TestFileRow } from '../types';

interface TestsFileTableProps {
  tests: TestFileRow[];
  selectedIds: Set<string>;
  runningId?: string | null;
  onSelectionChange: (ids: string[]) => void;
  onOpen: (id: string) => void;
  onRun: (id: string) => void;
  onDelete: (id: string, name: string) => void;
  onContextMenuRow?: (e: React.MouseEvent, test: TestFileRow) => void;
  onContextMenuEmpty?: (e: React.MouseEvent) => void;
  renderToolbar?: () => React.ReactNode;
}

export function TestsFileTable({
  tests,
  selectedIds,
  runningId = null,
  onSelectionChange,
  onOpen,
  onRun,
  onDelete,
  onContextMenuRow,
  onContextMenuEmpty,
  renderToolbar,
}: TestsFileTableProps) {
  const rowSelection = useMemo<RowSelectionState>(
    () => Object.fromEntries([...selectedIds].map((id) => [id, true])),
    [selectedIds],
  );

  // Synthesize the TestResult map that buildTestColumns expects from the
  // last-run snapshot stored on each TestFileRow. This lets the storage view
  // share the exact same columns/chips/buttons as the Test Runner page.
  const results = useMemo<Record<string, TestResult>>(() => {
    const out: Record<string, TestResult> = {};
    for (const t of tests) {
      if (!t.lastStatus || t.lastStatus === 'pending') continue;
      out[t.id] = {
        actualTools: t.lastActualTools ?? [],
        confidence: t.lastConfidence ?? 0,
        status: t.lastStatus as 'pass' | 'fail' | 'low_confidence',
        missingTools: t.lastMissingTools ?? [],
        scores: t.lastScores ?? [],
      };
    }
    return out;
  }, [tests]);

  const columns = useMemo(
    () =>
      buildTestColumns({
        results,
        runningId,
        onRun: (test) => onRun(test.id),
        onEdit: (test) => onOpen(test.id),
        onDelete: (test) => onDelete(test.id, test.name),
      }),
    [results, runningId, onRun, onOpen, onDelete],
  );

  return (
    <div
      className="min-h-full"
      onContextMenu={(e) => {
        if (!onContextMenuEmpty) return;
        const target = e.target as HTMLElement;
        if (target.closest('[data-row]')) return;
        e.preventDefault();
        onContextMenuEmpty(e);
      }}
    >
      <NTable<TestCase, 'table'>
        data={tests as unknown as TestCase[]}
        columns={columns}
        getRowId={(t) => t.id}
        availableModes={['table']}
        mode="table"
        showViewToggle={false}
        rowSelection={rowSelection}
        onRowSelectionChange={(next) => {
          onSelectionChange(Object.entries(next).filter(([, v]) => v).map(([k]) => k));
        }}
        onRowClick={(row) => onOpen(row.id)}
        onRowContextMenu={onContextMenuRow as any}
        renderToolbar={renderToolbar}
        renderEmpty={() => (
          <NEmptyState title="No tests in this file." />
        )}
      />
    </div>
  );
}
