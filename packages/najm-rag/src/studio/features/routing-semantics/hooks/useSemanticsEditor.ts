import { useState, useCallback } from 'react';
import type { SemanticPhraseResponse } from '@/features/routing-semantics/types';

export type CreateMode = null | 'single' | 'bulk';

export interface SemanticsFormState {
  phrase: string;
  toolName: string;
  lang: string;
}

export function useSemanticsEditor(defaultLang: string, initialToolName = '', initialLang = '') {
  const [createMode, setCreateMode] = useState<CreateMode>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<SemanticsFormState>({
    phrase: '',
    toolName: initialToolName,
    lang: initialLang || defaultLang,
  });

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

  const updateForm = useCallback((partial: Partial<SemanticsFormState>) => {
    setForm((prev) => ({ ...prev, ...partial }));
  }, []);

  return {
    createMode,
    editingId,
    form,
    setCreateMode,
    setEditingId,
    setForm: updateForm,
    startCreate,
    startEdit,
    cancelEdit,
  };
}
