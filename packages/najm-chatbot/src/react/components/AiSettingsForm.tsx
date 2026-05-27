'use client';

import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react';
import {
  Bot,
  CheckCircle2,
  ChevronDown,
  Cpu,
  ExternalLink,
  KeyRound,
  Link as LinkIcon,
  Loader2,
  MessageSquare,
  RotateCcw,
  PlugZap,
  Save,
  ShieldCheck,
  X,
  XCircle,
} from 'lucide-react';
import { PROVIDERS, PROVIDER_OPTIONS, type LlmProvider } from '../config/aiSettingsProviders';
import {
  aiSettingsFormSchema,
  buildAiSettingsPayload,
  type AiSettingsFormValues,
  type AiSettingsRecord,
} from '../hooks/useAiSettings';
import { useAuthenticatedFetch } from '../hooks/useAuthenticatedFetch';
import { cn } from '../lib/cn';
import type { I18nFn } from '../types';

type TestStatus = 'idle' | 'testing' | 'ok' | 'error';

interface AiSettingsApi {
  settings: AiSettingsRecord | null;
  isLoading: boolean;
  isSaving: boolean;
  error: Error | null;
  save: (values: AiSettingsFormValues) => Promise<AiSettingsRecord | null>;
}

export interface AiSettingsFormProps {
  settingsApi: AiSettingsApi;
  testApiPath?: string;
  t: I18nFn;
}

function initialValues(settings: AiSettingsRecord | null): AiSettingsFormValues {
  const provider = settings?.provider ?? 'zai';
  const meta = PROVIDERS[provider];

  return {
    provider,
    model: settings?.providerModels?.[provider] ?? settings?.model ?? meta.defaultModel,
    modelOptions: settings?.providerModelOptions?.[provider] ?? [],
    apiKey: '',
    baseUrl: settings?.baseUrl ?? meta.defaultBaseUrl,
    systemPrompt: settings?.systemPrompt ?? '',
    isEnabled: true,
    useMemory: settings?.useMemory ?? true,
    maxStoredMessages: settings?.maxStoredMessages ?? 100,
    maxPromptMessages: settings?.maxPromptMessages ?? 10,
  };
}

function FieldLabel({
  icon: Icon,
  children,
}: {
  icon: typeof Bot;
  children: string;
}) {
  return (
    <label className="flex items-center gap-2 text-xs font-semibold text-zinc-700 dark:text-zinc-300">
      <Icon className="h-3.5 w-3.5 text-[var(--ncb-primary)]" />
      {children}
    </label>
  );
}

export function AiSettingsForm({ settingsApi, testApiPath, t }: AiSettingsFormProps) {
  const authFetch = useAuthenticatedFetch();
  const [values, setValues] = useState<AiSettingsFormValues>(() => initialValues(settingsApi.settings));
  const [formError, setFormError] = useState<string | null>(null);
  const [testStatus, setTestStatus] = useState<TestStatus>('idle');
  const [testMessage, setTestMessage] = useState<string | null>(null);
  const [isModelMenuOpen, setIsModelMenuOpen] = useState(false);
  const previousProvider = useRef<LlmProvider>(values.provider);

  useEffect(() => {
    const next = initialValues(settingsApi.settings);
    previousProvider.current = next.provider;
    setValues(next);
  }, [settingsApi.settings]);

  const providerMeta = PROVIDERS[values.provider];
  const modelOptions = useMemo(() => {
    const options = [
      ...(values.model ? [values.model] : []),
      ...(values.modelOptions ?? []),
      ...providerMeta.modelSuggestions,
    ];
    return [...new Set(options.filter(Boolean))];
  }, [providerMeta.modelSuggestions, values.model, values.modelOptions]);
  const customModelOptions = useMemo(
    () => new Set(values.modelOptions ?? []),
    [values.modelOptions],
  );
  const hasSavedKey = Boolean(
    settingsApi.settings?.providerKeys?.[values.provider]
      ?? (settingsApi.settings?.provider === values.provider && settingsApi.settings?.hasKey),
  );

  const canSubmit = useMemo(() => {
    return !settingsApi.isLoading && !settingsApi.isSaving && testStatus !== 'testing';
  }, [settingsApi.isLoading, settingsApi.isSaving, testStatus]);

  const update = <Key extends keyof AiSettingsFormValues>(key: Key, value: AiSettingsFormValues[Key]) => {
    setValues((current) => ({ ...current, [key]: value }));
    setFormError(null);
    setTestStatus('idle');
    setTestMessage(null);
    setIsModelMenuOpen(false);
  };

  const updateProvider = (provider: LlmProvider) => {
    const meta = PROVIDERS[provider];
    previousProvider.current = provider;
    setValues((current) => ({
      ...current,
      provider,
      model: settingsApi.settings?.providerModels?.[provider] ?? meta.defaultModel,
      modelOptions: settingsApi.settings?.providerModelOptions?.[provider] ?? [],
      baseUrl: meta.defaultBaseUrl,
      apiKey: '',
    }));
    setFormError(null);
    setTestStatus('idle');
    setTestMessage(null);
    setIsModelMenuOpen(false);
  };

  useEffect(() => {
    if (previousProvider.current !== values.provider) {
      updateProvider(values.provider);
    }
  }, [values.provider]);

  const parseValues = () => {
    const parsed = aiSettingsFormSchema.safeParse(values);
    if (!parsed.success) {
      const message = parsed.error.issues[0]?.message ?? t('Invalid settings');
      setFormError(message);
      return null;
    }
    return parsed.data;
  };

  const withSavedModelOption = (input: AiSettingsFormValues): AiSettingsFormValues => {
    const isBuiltIn = PROVIDERS[input.provider].modelSuggestions.includes(input.model);
    const options = input.modelOptions ?? [];
    if (isBuiltIn || options.includes(input.model)) return input;
    return { ...input, modelOptions: [input.model, ...options] };
  };

  const save = async (event: FormEvent) => {
    event.preventDefault();
    const parsed = parseValues();
    if (!parsed) return;
    const payload = withSavedModelOption(parsed);

    try {
      await settingsApi.save(payload);
      setTestStatus('ok');
      setTestMessage(t('Saved'));
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      setFormError(error);
    }
  };

  const removeModelOption = async (model: string) => {
    const nextOptions = (values.modelOptions ?? []).filter((item) => item !== model);
    const nextModel = values.model === model
      ? providerMeta.modelSuggestions[0] ?? nextOptions[0] ?? providerMeta.defaultModel
      : values.model;
    const nextValues = { ...values, model: nextModel, modelOptions: nextOptions };

    setValues(nextValues);
    setIsModelMenuOpen(true);
    setFormError(null);
    setTestStatus('idle');
    setTestMessage(null);

    try {
      await settingsApi.save(nextValues);
      setTestStatus('ok');
      setTestMessage(t('Saved'));
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      setFormError(error);
    }
  };

  const testConnection = async () => {
    const parsed = parseValues();
    if (!parsed) return;

    if (!testApiPath) {
      setTestStatus('ok');
      setTestMessage(t('Settings look ready'));
      return;
    }

    setTestStatus('testing');
    setTestMessage(null);
    try {
      const requestBody = buildAiSettingsPayload(parsed);
      const response = await authFetch(testApiPath, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      });
      const responsePayload = await response.json().catch(() => null);
      if (!response.ok || responsePayload?.ok === false) {
        throw new Error(responsePayload?.error ?? `${response.status} ${response.statusText}`.trim());
      }
      setTestStatus('ok');
      setTestMessage(
        responsePayload?.resolvedModel
          ? `${t('Connected')} · ${responsePayload.resolvedModel}`
          : t('Connected'),
      );
    } catch (err) {
      setTestStatus('error');
      setTestMessage(err instanceof Error ? err.message : String(err));
    }
  };

  if (settingsApi.isLoading) {
    return (
      <div className="flex flex-1 flex-col gap-4 overflow-y-auto p-4">
        {Array.from({ length: 5 }).map((_, index) => (
          <div key={index} className="space-y-2">
            <div className="h-3 w-20 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="h-10 animate-pulse rounded-[var(--ncb-radius)] bg-zinc-100 dark:bg-zinc-900" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <form onSubmit={save} className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4">
        <div className="grid grid-cols-2 gap-2">
          {PROVIDER_OPTIONS.map((option) => {
            const active = values.provider === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => updateProvider(option.value)}
                className={cn(
                  'flex min-h-20 flex-col items-start justify-between rounded-[var(--ncb-radius)] border p-3 text-left transition',
                  active
                    ? 'border-[var(--ncb-primary)] bg-[color-mix(in_srgb,var(--ncb-primary)_10%,white)] text-zinc-950 dark:bg-zinc-900 dark:text-white'
                    : 'border-zinc-200 bg-white text-zinc-700 hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300',
                )}
              >
                <span className="text-sm font-semibold">{option.label}</span>
                <span className="line-clamp-2 text-xs leading-4 text-zinc-500">{t(PROVIDERS[option.value].description)}</span>
              </button>
            );
          })}
        </div>

        <div className="space-y-2">
          <FieldLabel icon={Cpu}>{t('Model')}</FieldLabel>
          <div className="relative">
            <div className="grid grid-cols-[1fr_auto]">
              <input
                value={values.model}
                onChange={(event) => update('model', event.target.value)}
                onFocus={() => setIsModelMenuOpen(modelOptions.length > 0)}
                placeholder={providerMeta.defaultModel}
                autoComplete="off"
                className="h-10 min-w-0 rounded-l-[var(--ncb-radius)] border border-r-0 border-zinc-200 bg-white px-3 text-sm outline-none focus:border-[var(--ncb-primary)] dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
              />
              <button
                type="button"
                onClick={() => setIsModelMenuOpen((open) => modelOptions.length > 0 ? !open : false)}
                disabled={modelOptions.length === 0}
                className="inline-flex h-10 w-10 items-center justify-center rounded-r-[var(--ncb-radius)] border border-zinc-200 bg-white text-zinc-500 transition hover:text-[var(--ncb-primary)] disabled:cursor-not-allowed disabled:opacity-40 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
                title={t('Show model suggestions')}
              >
                <ChevronDown className={cn('h-4 w-4 transition-transform', isModelMenuOpen && 'rotate-180')} />
              </button>
            </div>
            {isModelMenuOpen && modelOptions.length > 0 && (
              <div className="absolute left-0 right-0 top-11 z-50 max-h-56 overflow-y-auto rounded-[var(--ncb-radius)] border border-zinc-200 bg-white p-1 shadow-xl dark:border-zinc-800 dark:bg-zinc-950">
                {modelOptions.map((model) => {
                  const isCustom = customModelOptions.has(model);
                  return (
                  <button
                    key={model}
                    type="button"
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => {
                      update('model', model);
                      setIsModelMenuOpen(false);
                    }}
                    className={cn(
                      'flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-sm transition hover:bg-zinc-100 dark:hover:bg-zinc-900',
                      values.model === model
                        ? 'bg-[color-mix(in_srgb,var(--ncb-primary)_14%,white)] font-semibold text-[var(--ncb-primary)] dark:bg-zinc-900 dark:text-purple-300'
                        : 'text-zinc-700 hover:text-zinc-950 dark:text-zinc-300 dark:hover:text-white',
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{model}</span>
                    {isCustom && (
                      <span
                        role="button"
                        tabIndex={-1}
                        title={t('Remove model')}
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={(event) => {
                          event.preventDefault();
                          event.stopPropagation();
                          void removeModelOption(model);
                        }}
                        className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-400 hover:bg-red-500/10 hover:text-red-500 dark:text-zinc-500 dark:hover:text-red-300"
                      >
                        <X className="h-3.5 w-3.5" />
                      </span>
                    )}
                  </button>
                );
                })}
              </div>
            )}
          </div>
        </div>

        {providerMeta.needsKey && (
          <div className="space-y-2">
            <FieldLabel icon={KeyRound}>{t('API Key')}</FieldLabel>
            <input
              value={values.apiKey ?? ''}
              onChange={(event) => update('apiKey', event.target.value)}
              type="password"
              placeholder={hasSavedKey ? t('Saved key') : 'sk-...'}
              autoComplete="off"
              className="h-10 w-full rounded-[var(--ncb-radius)] border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-[var(--ncb-primary)] dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
            />
            <div className="flex items-center justify-between gap-3">
              {hasSavedKey && (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {t('Saved')}
                </span>
              )}
              {providerMeta.apiKeyUrl && (
                <a
                  href={providerMeta.apiKeyUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto inline-flex items-center gap-1 text-xs font-medium text-[var(--ncb-primary)] hover:underline"
                >
                  {t('Get key')}
                  <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          </div>
        )}

        {providerMeta.needsUrl && (
          <div className="space-y-2">
            <FieldLabel icon={LinkIcon}>{t('Base URL')}</FieldLabel>
            <input
              value={values.baseUrl ?? ''}
              onChange={(event) => update('baseUrl', event.target.value)}
              placeholder={providerMeta.defaultBaseUrl || 'https://api.example.com/v1'}
              className="h-10 w-full rounded-[var(--ncb-radius)] border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-[var(--ncb-primary)] dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
            />
          </div>
        )}

        <div className="space-y-2">
          <FieldLabel icon={MessageSquare}>{t('Instruction')}</FieldLabel>
          <textarea
            value={values.systemPrompt ?? ''}
            onChange={(event) => update('systemPrompt', event.target.value)}
            rows={5}
            placeholder={t('You are a helpful assistant.')}
            className="min-h-28 w-full resize-none rounded-[var(--ncb-radius)] border border-zinc-200 bg-white px-3 py-2 text-sm leading-5 outline-none focus:border-[var(--ncb-primary)] dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
          />
        </div>

        <label className="flex items-start gap-3 rounded-[var(--ncb-radius)] border border-zinc-200 bg-white p-3 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
          <input
            type="checkbox"
            checked={values.useMemory ?? true}
            onChange={(event) => update('useMemory', event.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-zinc-300 text-[var(--ncb-primary)] focus:ring-[var(--ncb-primary)] dark:border-zinc-700"
          />
          <span className="min-w-0 flex-1">
            <span className="flex items-center gap-2 font-semibold text-zinc-800 dark:text-zinc-100">
              <RotateCcw className="h-3.5 w-3.5 text-[var(--ncb-primary)]" />
              {t('Use conversation memory')}
            </span>
            <span className="mt-1 block text-xs leading-4 text-zinc-500">
              {t('Remember messages for this session and use them in follow-up replies.')}
            </span>
          </span>
        </label>

        <div className="space-y-2">
          <FieldLabel icon={RotateCcw}>{t('Stored memory limit')}</FieldLabel>
          <input
            type="number"
            min={1}
            max={10000}
            value={values.maxStoredMessages ?? ''}
            disabled={values.useMemory === false}
            onChange={(event) => {
              const next = event.target.value.trim();
              update('maxStoredMessages', next ? Number(next) : null);
            }}
            placeholder="100"
            className="h-10 w-full rounded-[var(--ncb-radius)] border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-[var(--ncb-primary)] disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
          />
        </div>

        <div className="space-y-2">
          <FieldLabel icon={MessageSquare}>{t('Messages sent to LLM')}</FieldLabel>
          <input
            type="number"
            min={1}
            max={2000}
            value={values.maxPromptMessages ?? ''}
            disabled={values.useMemory === false}
            onChange={(event) => {
              const next = event.target.value.trim();
              update('maxPromptMessages', next ? Number(next) : null);
            }}
            placeholder="10"
            className="h-10 w-full rounded-[var(--ncb-radius)] border border-zinc-200 bg-white px-3 text-sm outline-none focus:border-[var(--ncb-primary)] disabled:cursor-not-allowed disabled:opacity-60 dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
          />
        </div>
      </div>

      <div className="space-y-3 border-t border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-950">
        {(formError || settingsApi.error) && (
          <div className="flex items-start gap-2 rounded-[var(--ncb-radius)] border border-red-200 bg-red-50 p-2 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="break-words">{formError ?? settingsApi.error?.message}</span>
          </div>
        )}

        {testStatus === 'ok' && testMessage && (
          <div className="flex items-center gap-2 text-sm text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="truncate">{testMessage}</span>
          </div>
        )}

        {testStatus === 'error' && testMessage && (
          <div className="flex items-start gap-2 text-sm text-red-600 dark:text-red-400">
            <XCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span className="break-words">{testMessage}</span>
          </div>
        )}

        <div className="grid grid-cols-[1fr_auto] gap-2">
          <button
            type="submit"
            disabled={!canSubmit}
            className="inline-flex h-10 items-center justify-center gap-2 rounded-[var(--ncb-radius)] bg-[var(--ncb-primary)] px-4 text-sm font-semibold text-white transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {settingsApi.isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {t('Save')}
          </button>
          <button
            type="button"
            onClick={testConnection}
            disabled={!canSubmit}
            className="inline-flex h-10 w-10 items-center justify-center rounded-[var(--ncb-radius)] border border-zinc-200 bg-white text-zinc-700 transition hover:border-[var(--ncb-primary)] hover:text-[var(--ncb-primary)] disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-200"
            title={t('Test connection')}
          >
            {testStatus === 'testing' ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlugZap className="h-4 w-4" />}
          </button>
        </div>
      </div>
    </form>
  );
}
