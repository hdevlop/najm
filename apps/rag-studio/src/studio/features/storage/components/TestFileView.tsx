import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Play, Trash2, Loader2, CheckCircle2, XCircle, AlertTriangle, Pencil } from 'lucide-react';
import { Badge, Button, NSheet, NTable } from 'najm-kit';
import type { ColumnDef } from '@tanstack/react-table';
import { useApiClient } from '@/lib/api';
import { TestCaseForm } from '@/features/routing-tests/components/TestCaseForm';
import { useTestRunnerForm } from '@/features/routing-tests/hooks/useTestRunnerForm';

import type { TestFileRow } from '../types';

interface TestFileViewProps {
  test: TestFileRow;
  availableTools: string[];
  onDeleted: () => void;
  onMoved?: () => void;
}

function statusBadge(status?: TestFileRow['lastStatus']) {
  switch (status) {
    case 'pass':
      return <Badge variant="success" className="gap-1"><CheckCircle2 className="h-3 w-3" /> Pass</Badge>;
    case 'fail':
      return <Badge variant="destructive" className="gap-1"><XCircle className="h-3 w-3" /> Fail</Badge>;
    case 'low_confidence':
      return <Badge variant="warning" className="gap-1"><AlertTriangle className="h-3 w-3" /> Low confidence</Badge>;
    default:
      return <Badge variant="default">Not run</Badge>;
  }
}

function formatRelative(iso?: string | null): string {
  if (!iso) return '—';
  const date = new Date(iso);
  const diffMs = Date.now() - date.getTime();
  const mins = Math.round(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

export function TestFileView({ test, availableTools, onDeleted, onMoved }: TestFileViewProps) {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();
  const [current, setCurrent] = useState<TestFileRow>(test);
  const [saving, setSaving] = useState(false);

  const formCtl = useTestRunnerForm();
  const {
    form,
    editingId,
    showForm,
    formExpectedTools,
    setForm,
    resetForm,
    editTest,
    addExpectedTool,
    removeExpectedTool,
  } = formCtl;

  const openEdit = () => {
    editTest({
      id: current.id,
      name: current.name,
      query: current.query,
      lang: current.lang || 'und',
      expectedTools: current.expectedTools,
    });
  };

  const handleSave = async () => {
    const expectedTools = [...new Set(formExpectedTools.map((t) => t.trim()).filter(Boolean))];
    if (!form.name.trim() || !form.query.trim() || expectedTools.length === 0) return;
    const langBefore = current.lang || 'und';
    const langAfter = form.lang.trim() || 'und';
    setSaving(true);
    try {
      const updated = await apiClient.patch<TestFileRow>(`/routing-tests/${current.id}`, {
        name: form.name.trim(),
        query: form.query.trim(),
        lang: langAfter,
        expectedTools,
      });
      setCurrent(updated);
      queryClient.invalidateQueries({ queryKey: ['rag-studio', 'storage', 'tests-all'] });
      resetForm();
      // If the user moved the test to a different lang folder, pop back so navigation stays honest.
      if (langAfter !== langBefore) onMoved?.();
    } catch (err) {
      console.error('Failed to update routing test:', err);
    } finally {
      setSaving(false);
    }
  };

  const canSave = !!form.name.trim() && !!form.query.trim() && formExpectedTools.length > 0 && !saving;

  const runMutation = useMutation({
    mutationFn: () => apiClient.post<TestFileRow>(`/routing-tests/${current.id}/run`),
    onSuccess: (updated) => {
      setCurrent(updated);
      queryClient.invalidateQueries({ queryKey: ['rag-studio', 'storage', 'tests-all'] });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiClient.delete(`/routing-tests/${current.id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rag-studio', 'storage', 'tests-all'] });
      onDeleted();
    },
  });

  const scores = current.lastScores ?? [];

  const scoreColumns: ColumnDef<NonNullable<TestFileRow['lastScores']>[number], any>[] = [
    {
      accessorKey: 'toolName',
      header: 'Tool',
      cell: ({ row }) => <span className="font-mono text-sm">{row.original.toolName}</span>,
    },
    {
      accessorKey: 'similarity',
      header: 'Similarity',
      size: 120,
      cell: ({ row }) => <span className="block text-right text-sm">{row.original.similarity.toFixed(2)}</span>,
    },
    {
      accessorKey: 'matchLevel',
      header: 'Level',
      size: 120,
      cell: ({ row }) => <span className="text-sm text-txt-muted">{row.original.matchLevel}</span>,
    },
  ];

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" onClick={() => runMutation.mutate()} disabled={runMutation.isPending} className="gap-1.5">
          {runMutation.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          Run
        </Button>
        <Button size="sm" variant="outline" onClick={openEdit} className="gap-1.5">
          <Pencil className="h-3.5 w-3.5" /> Edit
        </Button>
        <Button
          size="sm"
          variant="destructive"
          onClick={() => {
            if (window.confirm(`Delete test "${current.name}"?`)) deleteMutation.mutate();
          }}
          disabled={deleteMutation.isPending}
          className="gap-1.5"
        >
          <Trash2 className="h-3.5 w-3.5" /> Delete
        </Button>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_1fr]">
          <dt className="text-xs uppercase tracking-wide text-txt-muted">Name</dt>
          <dd className="font-medium">{current.name}</dd>

          <dt className="text-xs uppercase tracking-wide text-txt-muted">Language</dt>
          <dd><Badge variant="outline">{current.lang || 'und'}</Badge></dd>

          <dt className="text-xs uppercase tracking-wide text-txt-muted">Query</dt>
          <dd className="font-mono text-sm">"{current.query}"</dd>

          <dt className="text-xs uppercase tracking-wide text-txt-muted">Expected tools</dt>
          <dd className="flex flex-wrap gap-1">
            {current.expectedTools.length === 0
              ? <span className="text-txt-muted">—</span>
              : current.expectedTools.map((t) => <Badge key={t} variant="secondary">{t}</Badge>)}
          </dd>
        </dl>
      </div>

      <div className="rounded-lg border border-border bg-card p-4">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold">Last run</h3>
          {statusBadge(current.lastStatus)}
        </div>
        <dl className="grid grid-cols-1 gap-3 sm:grid-cols-[auto_1fr]">
          <dt className="text-xs uppercase tracking-wide text-txt-muted">When</dt>
          <dd>{formatRelative(current.lastRunAt)}</dd>

          <dt className="text-xs uppercase tracking-wide text-txt-muted">Confidence</dt>
          <dd>{current.lastConfidence == null ? '—' : current.lastConfidence.toFixed(2)}</dd>

          <dt className="text-xs uppercase tracking-wide text-txt-muted">Actual tools</dt>
          <dd className="flex flex-wrap gap-1">
            {(current.lastActualTools ?? []).length === 0
              ? <span className="text-txt-muted">—</span>
              : (current.lastActualTools ?? []).map((t) => <Badge key={t} variant="outline">{t}</Badge>)}
          </dd>

          <dt className="text-xs uppercase tracking-wide text-txt-muted">Missing</dt>
          <dd className="flex flex-wrap gap-1">
            {(current.lastMissingTools ?? []).length === 0
              ? <span className="text-txt-muted">—</span>
              : (current.lastMissingTools ?? []).map((t) => <Badge key={t} variant="destructive">{t}</Badge>)}
          </dd>
        </dl>

        {scores.length > 0 && (
          <div className="mt-4">
            <h4 className="mb-2 text-xs uppercase tracking-wide text-txt-muted">Scores</h4>
            <NTable
              data={scores}
              columns={scoreColumns}
              getRowId={(s) => s.toolName}
              availableModes={['table']}
              mode="table"
              showCheckbox={false}
              showViewToggle={false}
              showPagination={false}
              showSorting={false}
              dynamicHeight={false}
              className="px-0"
            />
          </div>
        )}
      </div>

      <NSheet
        open={showForm}
        onOpenChange={(o) => { if (!o) resetForm(); }}
        title="Edit Test Case"
        description="Edit name, language, query, and expected tools."
        width={480}
      >
        <TestCaseForm
          availableTools={availableTools}
          form={form}
          formExpectedTools={formExpectedTools}
          editingId={editingId}
          onFormChange={setForm}
          onAddExpectedTool={() => addExpectedTool(form.expectedTool)}
          onRemoveExpectedTool={removeExpectedTool}
          onSave={handleSave}
          onCancel={resetForm}
          canSave={canSave}
        />
      </NSheet>
    </div>
  );
}
