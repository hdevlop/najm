import { useState, useCallback, useEffect } from 'react';
import { useApiClient } from '@/lib/api';
import type { SemanticPhraseResponse, SemanticsExportPayload, SemanticsImportResult, ImportJobState } from '@/features/routing-semantics/types';

export interface UseSemanticsEditorStateOptions {
  defaultLang: string;
  initialToolName?: string;
  initialLang?: string;
}

export interface UseSemanticsEditorStateResult {
  form: { phrase: string; toolName: string; lang: string };
  createMode: null | 'single' | 'bulk';
  editingId: string | null;
  setCreateMode: (mode: null | 'single' | 'bulk') => void;
  setEditingId: (id: string | null) => void;
  setForm: (partial: Partial<{ phrase: string; toolName: string; lang: string }>) => void;
  startCreate: (toolName: string, lang: string) => void;
  startEdit: (phrase: SemanticPhraseResponse) => void;
  cancelEdit: () => void;
}

export function useSemanticsEditorState({
  defaultLang,
  initialToolName = '',
  initialLang = '',
}: UseSemanticsEditorStateOptions): UseSemanticsEditorStateResult {
  const [createMode, setCreateMode] = useState<null | 'single' | 'bulk'>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ phrase: '', toolName: initialToolName, lang: initialLang || defaultLang });

  const startCreate = useCallback((toolName: string, lang: string) => {
    setCreateMode('single');
    setEditingId(null);
    setForm({ phrase: '', toolName, lang });
  }, []);

  const startEdit = useCallback((phrase: SemanticPhraseResponse) => {
    setCreateMode(null);
    setEditingId(phrase.id);
    setForm({ phrase: phrase.phrase, toolName: phrase.toolName, lang: phrase.lang });
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingId(null);
    setCreateMode(null);
    setForm({ phrase: '', toolName: initialToolName, lang: initialLang || defaultLang });
  }, [defaultLang, initialToolName, initialLang]);

  const updateForm = useCallback((partial: Partial<{ phrase: string; toolName: string; lang: string }>) => {
    setForm((prev) => ({ ...prev, ...partial }));
  }, []);

  return {
    form,
    createMode,
    editingId,
    setCreateMode,
    setEditingId,
    setForm: updateForm,
    startCreate,
    startEdit,
    cancelEdit,
  };
}

export function useSemanticsSelection(safePhrases: SemanticPhraseResponse[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleRow = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const toggleAllVisible = useCallback((visibleIds: string[], allVisibleSelected: boolean) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (allVisibleSelected) {
        for (const id of visibleIds) next.delete(id);
      } else {
        for (const id of visibleIds) next.add(id);
      }
      return next;
    });
  }, []);

  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const existing = new Set(safePhrases.map((p) => p.id));
      let changed = false;
      const next = new Set<string>();
      for (const id of prev) {
        if (existing.has(id)) next.add(id);
        else changed = true;
      }
      return changed ? next : prev;
    });
  }, [safePhrases]);

  const visibleIds = safePhrases.map((p) => p.id);
  const visibleSelectedCount = visibleIds.filter((id) => selectedIds.has(id)).length;
  const allVisibleSelected = visibleIds.length > 0 && visibleSelectedCount === visibleIds.length;
  const someVisibleSelected = visibleSelectedCount > 0 && !allVisibleSelected;

  return {
    selectedIds,
    toggleRow,
    toggleAllVisible,
    clearSelection,
    allVisibleSelected,
    someVisibleSelected,
    visibleIds,
  };
}

export function useSemanticsImportJob(
  onPollImportJob?: (jobId: string) => Promise<ImportJobState>,
  onImportComplete?: () => void | Promise<void>
) {
  const [importJob, setImportJob] = useState<ImportJobState | null>(null);
  const [importPollTimer, setImportPollTimer] = useState<ReturnType<typeof setInterval> | null>(null);
  const [transferring, setTransferring] = useState(false);
  const [banner, setBanner] = useState<{ kind: 'error' | 'warning' | 'info'; message: string } | null>(null);

  useEffect(() => {
    return () => { if (importPollTimer) clearInterval(importPollTimer); };
  }, [importPollTimer]);

  useEffect(() => {
    if (!importJob || !onPollImportJob) return;
    if (importJob.status === 'completed' || importJob.status === 'failed') {
      if (importPollTimer) { clearInterval(importPollTimer); setImportPollTimer(null); }
      if (importJob.status === 'completed') {
        if (importJob.failed > 0) {
          setBanner({ kind: 'warning', message: `Import complete with ${importJob.failed} failed: ${importJob.inserted} inserted, ${importJob.updated} updated, ${importJob.skipped} skipped.` });
        } else { setBanner(null); }
        setImportJob(null);
        onImportComplete?.();
      } else {
        setBanner({ kind: 'error', message: `Import failed: ${importJob.errors.join('; ')}` });
      }
      setTransferring(false);
      return;
    }
    if (importPollTimer) return;
    const timer = setInterval(async () => {
      try { const updated = await onPollImportJob(importJob.jobId); setImportJob(updated); }
      catch (err) { console.error('Failed to poll import job:', err); }
    }, 1500);
    setImportPollTimer(timer);
  }, [importJob?.status]);

  useEffect(() => {
    if (!banner || banner.kind !== 'info') return;
    const timer = setTimeout(() => setBanner(null), 5000);
    return () => clearTimeout(timer);
  }, [banner]);

  return {
    importJob,
    setImportJob,
    transferring,
    setTransferring,
    banner,
    setBanner,
  };
}

export function useSemanticsActions(
  apiClient: ReturnType<typeof useApiClient>,
  callbacks: {
    onSave: (phrase: Partial<SemanticPhraseResponse>) => Promise<SemanticPhraseResponse | null>;
    onDeleteBatch?: (ids: string[]) => Promise<{ deleted: number }>;
    onClearAll?: () => Promise<{ deleted: number } | void>;
    onReindexAll?: () => Promise<void>;
    onExport?: () => Promise<SemanticsExportPayload>;
    onImport?: (payload: SemanticsExportPayload) => Promise<SemanticsImportResult>;
    onImportFiles?: (files: File[]) => Promise<ImportJobState>;
  }
) {
  const [reindexing, setReindexing] = useState(false);
  const [deletingSelected, setDeletingSelected] = useState(false);

  const handleSave = useCallback(async (
    editingId: string | null,
    form: { phrase: string; toolName: string; lang: string },
    onSuccess: () => void,
    onWarning: (msg: string) => void,
    onError: (msg: string) => void
  ) => {
    try {
      const result = await callbacks.onSave({ id: editingId ?? undefined, phrase: form.phrase, toolName: form.toolName, lang: form.lang });
      onSuccess();
      if (result?.embeddingError) {
        onWarning(`Saved as PENDING — embedding failed: ${result.embeddingError}. Click "Reindex All" once the embedding service is reachable.`);
      } else if (result && !result.hasEmbedding) {
        onWarning('Saved without embedding — click "Reindex All" to retry.');
      }
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to save semantic phrase');
    }
  }, [callbacks]);

  const handleReindex = useCallback(async (
    onSuccess: () => void,
    onError: (msg: string) => void
  ) => {
    if (!callbacks.onReindexAll) return;
    setReindexing(true);
    try {
      await callbacks.onReindexAll();
      onSuccess();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Reindex failed');
    } finally {
      setReindexing(false);
    }
  }, [callbacks]);

  const handleDeleteSelected = useCallback(async (
    selectedIds: Set<string>,
    onSuccess: (count: number) => void,
    onError: (msg: string) => void,
    onClearSelection: () => void
  ) => {
    if (!callbacks.onDeleteBatch || selectedIds.size === 0) return;
    setDeletingSelected(true);
    try {
      const ids = Array.from(selectedIds);
      const result = await callbacks.onDeleteBatch(ids);
      onClearSelection();
      onSuccess(result.deleted);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to delete selection.');
    } finally {
      setDeletingSelected(false);
    }
  }, [callbacks]);

  const handleClearAll = useCallback(async (
    totalPhrases: number,
    onSuccess: (count: number) => void,
    onError: (msg: string) => void,
    onSetTransferring: (v: boolean) => void
  ) => {
    if (!callbacks.onClearAll) return;
    onSetTransferring(true);
    try {
      const result = await callbacks.onClearAll();
      const cleared = result as { deleted: number } | null;
      const deleted = cleared?.deleted ?? totalPhrases;
      onSuccess(deleted);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Failed to clear semantics');
    } finally {
      onSetTransferring(false);
    }
  }, [callbacks]);

  const handleExport = useCallback(async (
    onSuccess: () => void,
    onError: (msg: string) => void,
    onSetTransferring: (v: boolean) => void
  ) => {
    if (!callbacks.onExport) return;
    onSetTransferring(true);
    try {
      const payload = await callbacks.onExport();
      const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url; link.download = 'semantics_export.json';
      document.body.appendChild(link); link.click(); link.remove();
      URL.revokeObjectURL(url);
      onSuccess();
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Export failed');
    } finally {
      onSetTransferring(false);
    }
  }, [callbacks]);

  const handleLegacyImportFile = useCallback(async (
    file: File,
    onSuccess: (inserted: number, updated: number, skipped: number) => void,
    onError: (msg: string) => void,
    onSetTransferring: (v: boolean) => void
  ) => {
    if (!callbacks.onImport) return;
    onSetTransferring(true);
    try {
      const raw = await file.text();
      const payload = JSON.parse(raw) as SemanticsExportPayload;
      const result = await callbacks.onImport(payload);
      const inserted = result.results.filter((r) => r.status === 'inserted').length;
      const updated = result.results.filter((r) => r.status === 'updated').length;
      const skipped = result.results.filter((r) => r.status === 'skipped').length;
      onSuccess(inserted, updated, skipped);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Import failed');
    } finally {
      onSetTransferring(false);
    }
  }, [callbacks]);

  const handleFileImport = useCallback(async (
    files: File[],
    onJobStarted: (job: ImportJobState) => void,
    onError: (msg: string) => void,
    onSetTransferring: (v: boolean) => void
  ) => {
    if (!callbacks.onImportFiles) return;
    onSetTransferring(true);
    try {
      const job = await callbacks.onImportFiles(files);
      onJobStarted(job);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'Import failed');
      onSetTransferring(false);
    }
  }, [callbacks]);

  return {
    reindexing,
    deletingSelected,
    handleSave,
    handleReindex,
    handleDeleteSelected,
    handleClearAll,
    handleExport,
    handleLegacyImportFile,
    handleFileImport,
  };
}
