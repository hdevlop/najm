'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { z } from 'zod';
import { useAuthenticatedFetch } from './useAuthenticatedFetch';
import type { LlmProvider } from '../config/aiSettingsProviders';

export interface AiSettingsRecord {
  id?: string;
  provider: LlmProvider;
  model: string;
  baseUrl?: string | null;
  systemPrompt?: string | null;
  isEnabled?: boolean;
  useMemory?: boolean;
  maxStoredMessages?: number | null;
  maxPromptMessages?: number | null;
  hasKey?: boolean;
  providerKeys?: Partial<Record<LlmProvider, boolean>>;
  providerModels?: Partial<Record<LlmProvider, string>>;
  providerModelOptions?: Partial<Record<LlmProvider, string[]>>;
  createdAt?: string | null;
  updatedAt?: string | null;
}

export const aiSettingsFormSchema = z.object({
  provider: z.enum(['anthropic', 'openai', 'google', 'zai', 'opencode', 'openrouter', 'minimax', 'qwen', 'ollama', 'custom']),
  model: z.string().min(1).max(200),
  modelOptions: z.array(z.string().min(1).max(200)).max(100).optional(),
  apiKey: z.string().max(500).optional().nullable(),
  baseUrl: z.string().max(500).optional().nullable(),
  systemPrompt: z.string().max(2000).optional().nullable(),
  isEnabled: z.boolean().optional(),
  useMemory: z.boolean().optional(),
  maxStoredMessages: z.number().int().min(1).max(10000).optional().nullable(),
  maxPromptMessages: z.number().int().min(1).max(2000).optional().nullable(),
});

export type AiSettingsFormValues = z.infer<typeof aiSettingsFormSchema>;

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

async function readJsonBody<T>(response: Response): Promise<T | null> {
  const text = await response.text();
  if (!text.trim()) return null;
  return JSON.parse(text) as T;
}

export function buildAiSettingsPayload(values: AiSettingsFormValues): Record<string, unknown> {
  const parsed = aiSettingsFormSchema.parse(values);
  const payload: Record<string, unknown> = {
    provider: parsed.provider,
    model: parsed.model,
    modelOptions: parsed.modelOptions,
    baseUrl: normalizeOptionalText(parsed.baseUrl),
    systemPrompt: normalizeOptionalText(parsed.systemPrompt),
    isEnabled: true,
    useMemory: parsed.useMemory ?? true,
    maxStoredMessages: parsed.maxStoredMessages ?? 100,
    maxPromptMessages: parsed.maxPromptMessages ?? 10,
  };

  const apiKey = normalizeOptionalText(parsed.apiKey);
  if (apiKey) {
    payload.apiKey = apiKey;
  }

  return payload;
}

interface UseAiSettingsOptions {
  settingsApiPath: string;
  enabled?: boolean;
}

export function useAiSettings({ settingsApiPath, enabled = true }: UseAiSettingsOptions) {
  const authFetch = useAuthenticatedFetch();
  const [settings, setSettings] = useState<AiSettingsRecord | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const load = useCallback(async () => {
    if (!enabled) return null;
    setIsLoading(true);
    setError(null);
    try {
      const response = await authFetch(settingsApiPath);
      if (!response.ok) {
        throw new Error(`${response.status} ${response.statusText}`.trim());
      }
      const data = await readJsonBody<AiSettingsRecord>(response);
      const record = data && !Array.isArray(data) ? data as AiSettingsRecord : null;
      setSettings(record);
      return record;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      return null;
    } finally {
      setIsLoading(false);
    }
  }, [authFetch, enabled, settingsApiPath]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async (values: AiSettingsFormValues) => {
    const payload = buildAiSettingsPayload(values);

    setIsSaving(true);
    setError(null);
    try {
      const response = await authFetch(settingsApiPath, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `${response.status} ${response.statusText}`.trim());
      }
      const data = await readJsonBody<AiSettingsRecord>(response);
      const record = data && !Array.isArray(data) ? data as AiSettingsRecord : null;
      setSettings(record);
      return record;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      throw error;
    } finally {
      setIsSaving(false);
    }
  }, [authFetch, settingsApiPath]);

  return useMemo(() => ({
    settings,
    isLoading,
    isSaving,
    error,
    refetch: load,
    save,
  }), [error, isLoading, isSaving, load, save, settings]);
}
