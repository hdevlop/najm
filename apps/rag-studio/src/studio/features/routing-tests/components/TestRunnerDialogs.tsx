import React from 'react';
import { Download, Loader2, Play, Plus, TestTube, Trash2, Upload } from 'lucide-react';
import { Button } from 'najm-kit';
import { NConfirmDialog } from 'najm-kit';
import type { TestCase } from '../types';

interface TestRunnerToolbarProps {
  total: number;
  testsLength: number;
  passed: number;
  failed: number;
  lowConfidence: number;
  runningAll: boolean;
  clearing: boolean;
  transferring: boolean;
  filteredTestsLength: number;
  showForm: boolean;
  onOpenAddForm: () => void;
  onRunAll: () => void;
  onExport: () => void;
  onImportClick: () => void;
  onClearClick: () => void;
}

export function TestRunnerToolbar({
  total,
  testsLength,
  passed,
  failed,
  lowConfidence,
  runningAll,
  clearing,
  transferring,
  filteredTestsLength,
  showForm,
  onOpenAddForm,
  onRunAll,
  onExport,
  onImportClick,
  onClearClick,
}: TestRunnerToolbarProps) {
  const subtitle = total === 0
    ? 'Loading…'
    : `${total} test${total !== 1 ? 's' : ''} defined${testsLength < total ? ` · ${testsLength} loaded` : ''}${passed + failed + lowConfidence > 0 ? ` · ${passed} passed · ${failed + lowConfidence} failed` : ''}`;

  return (
    <div className="flex items-center justify-between px-4 py-3 border-b border-border">
      <div className="flex items-center gap-2">
        <div className="h-7 w-7 rounded-lg bg-brand/10 flex items-center justify-center">
          <TestTube className="h-3.5 w-3.5 text-brand" />
        </div>
        <div>
          <p className="text-sm font-medium text-txt-primary">Test Runner</p>
          <p className="text-xs text-txt-muted">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <Button  variant="outline" onClick={onExport} disabled={filteredTestsLength === 0} className="gap-1.5">
          <Download className="h-3.5 w-3.5" /> Export Visible
        </Button>
        <Button  variant="outline" onClick={onImportClick} disabled={transferring} className="gap-1.5">
          {transferring ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />} Import
        </Button>
        <Button  onClick={onOpenAddForm} disabled={showForm} className="gap-1.5">
          <Plus className="h-3.5 w-3.5" /> Add Test
        </Button>
        <Button  onClick={onRunAll} disabled={runningAll || testsLength === 0} className="gap-1.5">
          {runningAll ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />} Run All
        </Button>
      </div>
    </div>
  );
}

interface DeleteSelectedDialogProps {
  open: boolean;
  count: number;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function TestRunnerDeleteSelectedDialog({ open, count, loading, onConfirm, onCancel }: DeleteSelectedDialogProps) {
  return (
    <NConfirmDialog
      open={open}
      title={`Delete ${count} routing test${count === 1 ? '' : 's'}?`}
      description={`This will permanently delete ${count} routing test${count === 1 ? '' : 's'}.`}
      confirmLabel="Delete"
      variant="destructive"
      loading={loading}
      onConfirm={onConfirm}
      onOpenChange={(o) => { if (!o) onCancel(); }}
    />
  );
}

interface ClearAllDialogProps {
  open: boolean;
  testCount: number;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function TestRunnerClearAllDialog({ open, testCount, loading, onConfirm, onCancel }: ClearAllDialogProps) {
  return (
    <NConfirmDialog
      open={open}
      title="Clear all routing tests?"
      description={`This will permanently delete all ${testCount} routing test${testCount === 1 ? '' : 's'} and their last run results. Semantic phrases and tool definitions will stay unchanged.`}
      confirmLabel="Clear All"
      variant="destructive"
      loading={loading}
      onConfirm={onConfirm}
      onOpenChange={(o) => { if (!o) onCancel(); }}
    />
  );
}
