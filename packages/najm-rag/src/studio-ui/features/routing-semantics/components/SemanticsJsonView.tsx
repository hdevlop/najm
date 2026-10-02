import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import type { SemanticPhraseResponse, JsonViewColors, GroupedSemanticsPayload } from '@/features/routing-semantics/types';
import { useApiClient } from '@/lib/api';
import { NSmartPasteDialog } from 'najm-kit';
import type { SmartPastePreview } from 'najm-kit';
import { JsonEditor as StudioJsonEditor } from 'najm-kit/json';
import {
  loadAllFilteredPhrases,
  toGrouped,
  handleJsonSave,
  extractGroupedPayload,
  mergeSemanticsPayload,
  getSemanticsSignature,
  getSemanticsTextSignature,
} from '../utils/json-view-utils';

export interface SemanticsJsonViewProps {
  toolGroupFilter?: string;
  toolFilter?: string;
  langFilter?: string;
  searchQuery?: string;
  colors: JsonViewColors;
  onColorsChange?: (colors: JsonViewColors) => void;
  onRefresh: () => Promise<void>;
  compact?: boolean;
}

function semanticsParseAndPreview(pasteJson: unknown, currentJson: string): SmartPastePreview | null {
  const incoming = extractGroupedPayload(pasteJson);
  if (!Object.keys(incoming).length) return null;
  try {
    const current = JSON.parse(currentJson) as GroupedSemanticsPayload;
    const merged = mergeSemanticsPayload(current, incoming);
    let newCount = 0;
    let dupeCount = 0;
    for (const [tool, langs] of Object.entries(incoming)) {
      for (const [lang, phrases] of Object.entries(langs)) {
        for (const phrase of phrases) {
          if (current[tool]?.[lang]?.includes(phrase)) dupeCount++;
          else newCount++;
        }
      }
    }
    return {
      mergedJson: JSON.stringify(merged, null, 2),
      newCount,
      dupeCount,
      label: `${Object.keys(incoming).length} tool${Object.keys(incoming).length !== 1 ? 's' : ''}`,
    };
  } catch {
    return null;
  }
}

export function SemanticsJsonView({
  toolGroupFilter,
  toolFilter,
  langFilter,
  searchQuery,
  colors,
  onColorsChange: _onColorsChange,
  onRefresh,
  compact = false,
}: SemanticsJsonViewProps) {
  const apiClient = useApiClient();

  const filters = { toolGroup: toolGroupFilter, toolName: toolFilter, lang: langFilter, search: searchQuery };
  const allFilteredQuery = useQuery({
    queryKey: ['rag-studio', 'semantics', 'phrases-all', filters],
    queryFn: () => loadAllFilteredPhrases(apiClient, filters),
  });
  const allFilteredPhrases = allFilteredQuery.data ?? [];
  const loadingAll = allFilteredQuery.isLoading;

  const sourceString = useMemo(
    () => JSON.stringify(toGrouped(allFilteredPhrases), null, 2),
    [allFilteredPhrases]
  );
  const sourceSignature = useMemo(
    () => getSemanticsSignature(toGrouped(allFilteredPhrases)),
    [allFilteredPhrases]
  );

  const [editText, setEditText] = useState<string | null>(null);
  const displayText = editText !== null ? editText : sourceString;
  const editSignature = useMemo(
    () => editText === null ? null : getSemanticsTextSignature(editText),
    [editText]
  );
  const savedSignatureRef = useRef<string | null>(null);
  const isDirty = editText !== null
    && (editSignature === null
      ? editText !== sourceString
      : editSignature !== sourceSignature && editSignature !== savedSignatureRef.current);

  const [parseError, setParseError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [smartPasteOpen, setSmartPasteOpen] = useState(false);

  const savingRef = useRef(saving);
  savingRef.current = saving;

  const parseAndPreview = useCallback(
    (pasteJson: unknown, currentJson: string) => semanticsParseAndPreview(pasteJson, currentJson),
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
    const nextSignature = getSemanticsTextSignature(text);
    if (nextSignature === null || nextSignature === sourceSignature) {
      savedSignatureRef.current = null;
      setSaveSuccess(null);
      setEditText(null);
      return { inserted: 0, updated: 0, deleted: 0, changed: false };
    }
    setSaving(true);
    setSaveError(null);
    setSaveSuccess(null);
    try {
      const result = await handleJsonSave(text, allFilteredPhrases, apiClient, onRefresh);
      savedSignatureRef.current = nextSignature;
      setSaveSuccess(
        result.changed
          ? `Saved: ${result.inserted} inserted, ${result.updated} updated, ${result.deleted} deleted.`
          : null
      );
      if (result.changed) allFilteredQuery.refetch();
      setEditText(null);
      return result;
    } catch (err: any) {
      setSaveError(err.message || 'Save failed. The content is still in the editor.');
      savedSignatureRef.current = null;
      throw err;
    } finally {
      setSaving(false);
    }
  }, [allFilteredPhrases, apiClient, onRefresh, sourceSignature, allFilteredQuery]);

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

  const handleReset = useCallback(() => setEditText(sourceString), [sourceString]);
  const handleCancel = useCallback(() => setEditText(null), []);

  const lines = displayText.split('\n');

  return (
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
        itemCount={allFilteredPhrases.length}
        itemLabel="phrases"
        loadingLabel="Loading all phrases..."
        readOnly={false}
        smartPasteLabel="Smart Paste"
        onSmartPaste={compact ? undefined : () => setSmartPasteOpen(true)}
        showActions={!compact}
        highlightDuplicateStrings={true}
      />
      {!compact && (
        <NSmartPasteDialog
          open={smartPasteOpen}
          currentJson={displayText}
          colors={colors}
          title="Smart Paste & Merge — Semantics"
          description="Paste AI-generated JSON below. Supports { tool: { lang: [...] } }, { items: [...] }, and { tools: {...} } formats."
          placeholder={'{\n  "toolName": {\n    "en": ["new phrase 1", "new phrase 2"]\n  }\n}'}
          emptyMessage="Could not extract any semantic phrases from this JSON."
          itemLabel="phrase"
          onMerge={handleMerge}
          onCancel={() => setSmartPasteOpen(false)}
          parseAndPreview={parseAndPreview}
        />
      )}
    </>
  );
}
