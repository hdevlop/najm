import { useState, useCallback } from 'react';
import type { TestCase } from '../types';

export interface TestRunnerFormState {
  name: string;
  query: string;
  lang: string;
  expectedTool: string;
}

type FormField = keyof TestRunnerFormState;

const EMPTY: TestRunnerFormState = { name: '', query: '', lang: 'en', expectedTool: '' };

export function useTestRunnerForm() {
  const [form, setForm] = useState<TestRunnerFormState>(EMPTY);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [formExpectedTools, setFormExpectedTools] = useState<string[]>([]);

  const resetForm = useCallback(() => {
    setForm(EMPTY);
    setFormExpectedTools([]);
    setEditingId(null);
    setShowForm(false);
  }, []);

  const openAddForm = useCallback(() => {
    resetForm();
    setShowForm(true);
  }, [resetForm]);

  const editTest = useCallback((test: TestCase) => {
    setEditingId(test.id);
    setForm({ name: test.name, query: test.query, lang: test.lang || 'en', expectedTool: '' });
    setFormExpectedTools([...test.expectedTools]);
    setShowForm(true);
  }, []);

  const formChange = useCallback((field: FormField, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  const addExpectedTool = useCallback((tool: unknown) => {
    if (typeof tool !== 'string') return;
    if (!tool.trim() || formExpectedTools.includes(tool)) return;
    setFormExpectedTools((prev) => [...prev, tool]);
    setForm((prev) => ({ ...prev, expectedTool: '' }));
  }, [formExpectedTools]);

  const removeExpectedTool = useCallback((tool: string) => {
    setFormExpectedTools((prev) => prev.filter((t) => t !== tool));
  }, []);

  return {
    form,
    editingId,
    showForm,
    formExpectedTools,
    setForm: formChange,
    setEditingId,
    setShowForm,
    resetForm,
    openAddForm,
    editTest,
    addExpectedTool,
    removeExpectedTool,
  };
}
