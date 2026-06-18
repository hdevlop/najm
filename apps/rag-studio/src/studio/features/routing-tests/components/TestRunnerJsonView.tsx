import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RoutingTestCase } from '../types';
import type { JsonViewColors } from '@/features/routing-tools/types';
import { useApiClient } from '@/lib/api';
import { NSmartPasteDialog } from 'najm-kit';
import type { SmartPastePreview } from 'najm-kit';
import { JsonEditor as StudioJsonEditor } from 'najm-kit/json';
import type { TestResult } from '../types';
import { cn } from '@/lib/utils';
import { Loader2 } from 'lucide-react';

type TestRow = Pick<RoutingTestCase, 'id' | 'name' | 'query' | 'expectedTools'>;

export interface TestRunnerJsonViewProps {
  rows: TestRow[];
  filteredRows: TestRow[];
  results: Record<string, TestResult>;
  loadingAll: boolean;
  colors: JsonViewColors;
  onRefresh: () => Promise<void>;
  runningAll?: boolean;
}

function isValidTestEntry(t: unknown): t is { name: string; query: string; expectedTools: string[] } {
  if (typeof t !== 'object' || t === null) return false;
  const o = t as any;
  return typeof o.name === 'string' && o.name.length > 0
    && typeof o.query === 'string' && o.query.length > 0
    && Array.isArray(o.expectedTools)
    && o.expectedTools.every((tool: unknown) => typeof tool === 'string');
}

function extractTestPayload(raw: unknown): { name: string; query: string; expectedTools: string[] }[] {
  if (Array.isArray(raw)) {
    return raw.filter(isValidTestEntry);
  }
  if (raw && typeof raw === 'object') {
    const o = raw as any;
    if (Array.isArray(o.tests)) return o.tests.filter(isValidTestEntry);
    if (Array.isArray(o.items)) return o.items.filter(isValidTestEntry);
  }
  return [];
}

function testKey(t: { name: string; query: string; expectedTools: string[] }): string {
  return `${t.name}|${t.query}|${[...t.expectedTools].sort().join(',')}`;
}

function getResultSummary(test: TestRow, results: Record<string, TestResult>) {
  const result = results[test.id];
  if (!result) return null;
  const missingTools = test.expectedTools.filter((tool) => !result.actualTools.includes(tool));
  const extraTools = result.actualTools.filter((tool) => !test.expectedTools.includes(tool));
  return {
    status: result.status,
    actualTools: result.actualTools,
    missingTools,
    extraTools,
    confidence: result.confidence,
  };
}

function toEditableTest(t: TestRow, results?: Record<string, TestResult>) {
  const result = results ? getResultSummary(t, results) : null;
  return {
    name: t.name,
    query: t.query,
    expectedTools: t.expectedTools,
    ...(result && result.status !== 'pass' ? { _result: result } : {}),
  };
}

function normalizeTestPayload(value: unknown): { name: string; query: string; expectedTools: string[] }[] | null {
  const rawTests = Array.isArray(value) ? value : (value as any)?.tests ?? [];
  if (!Array.isArray(rawTests)) return null;
  const tests = rawTests.map((t: any) => ({
    name: t.name,
    query: t.query,
    expectedTools: t.expectedTools,
  }));
  return isValidTestPayload(tests) ? tests : null;
}

function getTestSignature(tests: { name: string; query: string; expectedTools: string[] }[]): string {
  return tests.map(testKey).sort().join('\u0001');
}

function getTestTextSignature(text: string): string | null {
  try {
    const tests = normalizeTestPayload(JSON.parse(text));
    return tests ? getTestSignature(tests) : null;
  } catch {
    return null;
  }
}

function testsParseAndPreview(pasteJson: unknown, currentJson: string): SmartPastePreview | null {
  const incoming = extractTestPayload(pasteJson);
  if (!incoming.length) return null;
  try {
    const current = JSON.parse(currentJson);
    const currentTests = Array.isArray(current) ? current : current.tests ?? [];
    const existingKeys = new Set(currentTests.map(testKey));
    let newCount = 0;
    let dupeCount = 0;
    for (const t of incoming) {
      if (existingKeys.has(testKey(t))) dupeCount++;
      else newCount++;
    }
    const merged = [...currentTests];
    for (const t of incoming) {
      if (!existingKeys.has(testKey(t))) merged.push(t);
    }
    return {
      mergedJson: JSON.stringify(merged, null, 2),
      newCount,
      dupeCount,
      label: `${incoming.length} test${incoming.length !== 1 ? 's' : ''}`,
    };
  } catch {
    return null;
  }
}

function isValidTestPayload(value: unknown): value is RoutingTestCase[] {
  if (!Array.isArray(value)) return false;
  return value.every(
    (t) =>
      typeof t === 'object' &&
      t !== null &&
      typeof (t as any).name === 'string' &&
      (t as any).name.length > 0 &&
      typeof (t as any).query === 'string' &&
      (t as any).query.length > 0 &&
      Array.isArray((t as any).expectedTools) &&
      (t as any).expectedTools.every((tool: unknown) => typeof tool === 'string')
  );
}

async function handleTestJsonSave(
  editText: string,
  currentRows: TestRow[],
  apiClient: ReturnType<typeof useApiClient>,
  onRefresh: () => Promise<void>
): Promise<{ inserted: number; updated: number; deleted: number; changed: boolean }> {
  const parsed = JSON.parse(editText);
  const tests = normalizeTestPayload(parsed);
  if (!isValidTestPayload(tests))
    throw new Error(
      'Invalid test format. Expected array of { name, query, expectedTools }.'
    );

  const newKeys = new Map<string, { name: string; query: string; expectedTools: string[] }>();
  for (const t of tests) {
    newKeys.set(
      `${t.name}|${t.query}|${[...t.expectedTools].sort().join(',')}`,
      t
    );
  }

  const existingKeyToId = new Map<string, string>();
  currentRows.forEach((t) => {
    existingKeyToId.set(
      `${t.name}|${t.query}|${[...t.expectedTools].sort().join(',')}`,
      t.id
    );
  });

  const removedIds = currentRows
    .filter(
      (t) =>
        !newKeys.has(
          `${t.name}|${t.query}|${[...t.expectedTools].sort().join(',')}`
        )
    )
    .map((t) => t.id);

  const addedTests = tests.filter(
    (t) => !existingKeyToId.has(`${t.name}|${t.query}|${[...t.expectedTools].sort().join(',')}`)
  );

  const hasAdditions = addedTests.length > 0;
  if (!hasAdditions && removedIds.length === 0) {
    return { inserted: 0, updated: 0, deleted: 0, changed: false };
  }

  const [deleteResult, importResult] = await Promise.all([
    removedIds.length > 0
      ? apiClient.post<{ deleted: number }>('/routing-tests/delete-batch', {
          ids: removedIds,
        })
      : Promise.resolve({ deleted: 0 }),
    hasAdditions
      ? apiClient.post<{ imported: number }>(
          '/routing-tests/import',
          { tests: addedTests, mode: 'append' }
        )
      : Promise.resolve({ imported: 0 }),
  ]);

  await onRefresh();
  return {
    inserted: importResult?.imported ?? 0,
    updated: 0,
    deleted: deleteResult?.deleted ?? 0,
    changed: true,
  };
}

export function TestRunnerJsonView({
  filteredRows,
  results,
  loadingAll,
  colors,
  onRefresh,
  runningAll,
}: TestRunnerJsonViewProps) {
  const apiClient = useApiClient();
  const [jsonTab, setJsonTab] = useState<'tests' | 'results'>('tests');

  // Tests tab: editable definitions
  const sortedRows = useMemo(() => {
    const statusOrder: Record<string, number> = { fail: 0, low_confidence: 1, pass: 2, pending: 3 };
    return [...filteredRows].sort((a, b) => {
      const sa = results[a.id]?.status ?? 'pending';
      const sb = results[b.id]?.status ?? 'pending';
      return (statusOrder[sa] ?? 3) - (statusOrder[sb] ?? 3);
    });
  }, [filteredRows, results]);

  const testsSource = useMemo(
    () =>
      JSON.stringify(
        sortedRows.map((row) => toEditableTest(row, results)),
        null,
        2
      ),
    [sortedRows, results]
  );
  const testsSourceSignature = useMemo(
    () => getTestSignature(filteredRows.map((row) => toEditableTest(row))),
    [filteredRows]
  );

  // Results tab: read-only result-enriched JSON, sorted by status and color-highlighted in the editor
  const resultsSource = useMemo(() => {
    return JSON.stringify(
      sortedRows.map((t) => {
        const base = {
          name: t.name,
          query: t.query,
          expectedTools: t.expectedTools,
        };
        const r = results[t.id];
        if (!r) {
          return { ...base, status: 'pending' };
        }
        return {
          ...base,
          status: r.status,
          actualTools: r.actualTools,
          missingTools: r.missingTools,
          confidence: r.confidence,
          scores: r.scores,
        };
      }),
      null,
      2
    );
  }, [sortedRows, results]);

  const summary = useMemo(() => {
    const failed = filteredRows.filter((row) => results[row.id]?.status === 'fail');
    const lowConfidence = filteredRows.filter((row) => results[row.id]?.status === 'low_confidence');
    const missingTools = Array.from(new Set(failed.flatMap((row) => getResultSummary(row, results)?.missingTools ?? [])));
    return { failed: failed.length, lowConfidence: lowConfidence.length, missingTools };
  }, [filteredRows, results]);

  // Edit state for Tests tab
  const [editText, setEditText] = useState<string | null>(null);
  const displayText = editText !== null ? editText : testsSource;
  const editSignature = useMemo(
    () => editText === null ? null : getTestTextSignature(editText),
    [editText]
  );
  const savedSignatureRef = useRef<string | null>(null);
  const isDirty = editText !== null
    && (editSignature === null
      ? editText !== testsSource
      : editSignature !== testsSourceSignature && editSignature !== savedSignatureRef.current);

  const [parseError, setParseError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [smartPasteOpen, setSmartPasteOpen] = useState(false);

  const savingRef = useRef(saving);
  savingRef.current = saving;

  const parseAndPreview = useCallback(
    (pasteJson: unknown, currentJson: string) => testsParseAndPreview(pasteJson, currentJson),
    [],
  );

  const handleChange = useCallback((value: string) => {
    setEditText(value);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      JSON.parse(value);
      setParseError(null);
    } catch (e: any) {
      setParseError(e.message);
    }
  }, []);

  // Shared save helper — used by both manual Save and Smart-Paste merge
  const performSave = useCallback(async (text: string) => {
    if (savingRef.current) return;
    const nextSignature = getTestTextSignature(text);
    if (nextSignature === null || nextSignature === testsSourceSignature) {
      savedSignatureRef.current = null;
      setSaveSuccess(null);
      setEditText(null);
      return { inserted: 0, updated: 0, deleted: 0, changed: false };
    }
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      const result = await handleTestJsonSave(text, filteredRows, apiClient, onRefresh);
      savedSignatureRef.current = nextSignature;
      setSaveSuccess(
        result.changed
          ? `Saved: ${result.inserted} inserted, ${result.updated} updated, ${result.deleted} deleted.`
          : null
      );
      setEditText(null);
      return result;
    } catch (err: any) {
      setSaveError(err.message || 'Save failed. The content is still in the editor.');
      savedSignatureRef.current = null;
      throw err;
    } finally {
      setSaving(false);
    }
  }, [filteredRows, apiClient, onRefresh, testsSourceSignature]);

  const handleSave = useCallback(async () => {
    if (!isDirty || parseError || editText === null || saving) return;
    await performSave(editText);
  }, [isDirty, parseError, editText, saving, performSave]);

  const handleMerge = useCallback((mergedJson: string) => {
    setEditText(mergedJson);
    setSaveError(null);
    setSaveSuccess(null);
    setParseError(null);
    setSmartPasteOpen(false);
  }, []);

  const handleReset = useCallback(() => setEditText(testsSource), [testsSource]);
  const handleCancel = useCallback(() => setEditText(null), []);

  const activeText = jsonTab === 'tests' ? displayText : resultsSource;
  const lines = activeText.split('\n');

  const tabHeader = (
    <>
      <button
        onClick={() => setJsonTab('tests')}
        className={cn(
          'text-xs px-2.5 py-1 rounded-md border transition-colors font-medium',
          jsonTab === 'tests'
            ? 'bg-primary text-primary-foreground border-primary'
            : 'bg-transparent text-txt-muted border-border hover:bg-accent hover:text-txt-primary'
        )}
      >
        Tests
      </button>
      <button
        onClick={() => setJsonTab('results')}
        className={cn(
          'text-xs px-2.5 py-1 rounded-md border transition-colors font-medium',
          jsonTab === 'results'
            ? 'bg-primary text-primary-foreground border-primary'
            : 'bg-transparent text-txt-muted border-border hover:bg-accent hover:text-txt-primary'
        )}
      >
        Results
      </button>
      {runningAll && (
        <span className="text-xs text-amber-400 flex items-center gap-1.5 ml-1 animate-pulse">
          <Loader2 className="h-3 w-3 animate-spin" /> Running…
        </span>
      )}
    </>
  );

  const resultSummaryAddon = (summary.failed > 0 || summary.lowConfidence > 0) ? (
    <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs">
      {summary.failed > 0 && <span className="shrink-0 font-medium text-status-red">{summary.failed} failed</span>}
      {summary.lowConfidence > 0 && (
        <span className="shrink-0 font-medium text-status-yellow">{summary.lowConfidence} low confidence</span>
      )}
      {summary.missingTools.length > 0 && (
        <span className="min-w-0 truncate text-txt-muted">
          Missing: <span className="font-mono text-status-red">{summary.missingTools.join(', ')}</span>
        </span>
      )}
    </div>
  ) : null;

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {jsonTab === 'tests' ? (
        <>
          <StudioJsonEditor
            value={displayText}
            onChange={handleChange}
            onSave={handleSave}
            onReset={handleReset}
            onCancel={handleCancel}
            dirty={isDirty}
            parseError={parseError}
            saveError={saveError}
            saveSuccess={saveSuccess}
            loading={loadingAll}
            saving={saving}
            colors={colors}
            lineCount={lines.length}
            itemCount={filteredRows.length}
            itemLabel="tests"
            loadingLabel="Loading tests…"
            readOnly={false}
            smartPasteLabel="Smart Paste"
            onSmartPaste={() => setSmartPasteOpen(true)}
            headerMiddle={tabHeader}
            statusAddon={resultSummaryAddon}
            highlightDuplicateStrings={false}
            highlightStatusStrings={true}
          />
          <NSmartPasteDialog
            open={smartPasteOpen}
            currentJson={displayText}
            colors={colors}
            title="Smart Paste & Merge — Tests"
            description="Paste test cases below. Supports [{ name, query, expectedTools }] arrays and { tests: [...] } format."
            placeholder={'[\n  {\n    "name": "Test name",\n    "query": "user query",\n    "expectedTools": ["toolName"]\n  }\n]'}
            emptyMessage="Could not extract any test cases from this JSON."
            itemLabel="test"
            onMerge={handleMerge}
            onCancel={() => setSmartPasteOpen(false)}
            parseAndPreview={parseAndPreview}
          />
        </>
      ) : (
        <StudioJsonEditor
          value={resultsSource}
          onChange={() => {}}
          onSave={() => {}}
          onReset={() => {}}
          onCancel={() => {}}
          dirty={false}
          parseError={null}
          saveError={null}
          saveSuccess={null}
          loading={false}
          saving={false}
          colors={colors}
          lineCount={lines.length}
          itemCount={filteredRows.length}
          itemLabel="tests"
          loadingLabel="Loading results…"
          readOnly={true}
          headerMiddle={tabHeader}
          statusAddon={resultSummaryAddon}
          highlightStatusStrings={true}
        />
      )}
    </div>
  );
}
