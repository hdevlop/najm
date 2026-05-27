'use client';

import { type CSSProperties, useEffect, useMemo, useState, useCallback } from 'react';
import { Bot, Sparkles, X } from 'lucide-react';
import { ChatPanel } from './ChatPanel';
import { useAiSettings } from '../hooks/useAiSettings';
import { useToolStatus } from '../hooks/useToolStatus';
import { cn, inferMcpPath, joinApiPath } from '../lib/cn';
import type {
  ChatbotProps,
  ChatbotSize,
  ChatbotSlots,
  ChatbotStatus,
  ChatbotSuggestion,
  ChatbotSuggestionInput,
  I18nFn,
  TriggerSlotProps,
} from '../types';

const SIZE_STORAGE_KEY = 'ncb-size';
const SIZES: ChatbotSize[] = ['sm', 'md', 'lg', 'xl'];

const sizeClasses: Record<ChatbotSize, string> = {
  sm: 'bottom-24 right-5 h-[520px] w-[340px] max-h-[calc(100dvh-8rem)] max-w-[calc(100vw-2.5rem)]',
  md: 'bottom-24 right-5 h-[620px] w-[400px] max-h-[calc(100dvh-8rem)] max-w-[calc(100vw-2.5rem)]',
  lg: 'bottom-24 right-5 h-[720px] w-[480px] max-h-[calc(100dvh-8rem)] max-w-[calc(100vw-2.5rem)]',
  xl: 'bottom-5 right-5 top-5 w-[640px] max-w-[calc(100vw-2.5rem)]',
};

function readStoredSize(): ChatbotSize | null {
  if (typeof window === 'undefined') return null;
  try {
    const value = window.localStorage.getItem(SIZE_STORAGE_KEY);
    return SIZES.includes(value as ChatbotSize) ? (value as ChatbotSize) : null;
  } catch {
    return null;
  }
}

const defaultSuggestions: ChatbotSuggestion[] = [
  { label: 'Summarize recent activity', text: 'Summarize recent activity and highlight anything that needs attention.' },
  { label: 'Find important records', text: 'Search the available tools for important records related to my current task.' },
  { label: 'Draft a response', text: 'Draft a concise response I can review before sending.' },
  { label: 'Explain this workflow', text: 'Explain the next steps for this workflow.' },
];

const statusClass: Record<ChatbotStatus, string> = {
  ready: 'bg-emerald-400',
  'empty-tools': 'bg-amber-400',
  disabled: 'bg-zinc-400',
};

function normalizeSuggestions(input: ChatbotSuggestionInput[] | undefined): ChatbotSuggestion[] {
  const source = input?.length ? input : defaultSuggestions;
  return source.map((suggestion) => (
    typeof suggestion === 'string'
      ? { label: suggestion, text: suggestion }
      : suggestion
  ));
}

function useIsCoarsePointer(): boolean {
  const [coarse, setCoarse] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mql = window.matchMedia('(pointer: coarse)');
    setCoarse(mql.matches);
    const handler = (e: MediaQueryListEvent) => setCoarse(e.matches);
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }, []);

  return coarse;
}

function DefaultTrigger({ open, status, onToggle, t }: TriggerSlotProps) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'fixed bottom-5 right-5 z-50 inline-flex h-14 w-14 items-center justify-center rounded-full bg-[var(--ncb-primary)] text-white shadow-xl shadow-black/20 transition hover:-translate-y-0.5 hover:brightness-95 focus:outline-none focus:ring-2 focus:ring-[var(--ncb-primary)] focus:ring-offset-2 dark:focus:ring-offset-zinc-950',
        open && 'rotate-90',
      )}
      title={t('AI Assistant')}
      aria-label={t('AI Assistant')}
      aria-expanded={open}
    >
      {open ? (
        <X className="h-5 w-5" />
      ) : (
        <span className="relative">
          <Bot className="h-6 w-6" />
          <Sparkles className="absolute -right-1 -top-1 h-3 w-3 text-yellow-200" />
        </span>
      )}
      <span
        className={cn(
          'absolute bottom-1.5 right-1.5 h-3 w-3 rounded-full border-2 border-white dark:border-zinc-950',
          statusClass[status],
        )}
      />
    </button>
  );
}

export function Chatbot({
  suggestions,
  apiPath = '/chat',
  settingsApiPath = '/ai-settings',
  mcpApiPath,
  testApiPath,
  sessionKey,
  initialOpen = false,
  initialSize = 'md',
  persistSize = true,
  slots,
  theme,
  i18n,
  className,
  panelClassName,
  style,
}: ChatbotProps) {
  const [open, setOpen] = useState(initialOpen);
  const [size, setSizeState] = useState<ChatbotSize>(initialSize);
  useEffect(() => {
    if (!persistSize) return;
    const stored = readStoredSize();
    if (stored) setSizeState(stored);
  }, [persistSize]);
  const setSize = useCallback((next: ChatbotSize) => {
    setSizeState(next);
    if (persistSize && typeof window !== 'undefined') {
      try { window.localStorage.setItem(SIZE_STORAGE_KEY, next); } catch { /* ignore */ }
    }
  }, [persistSize]);
  const isCoarse = useIsCoarsePointer();
  const t: I18nFn = i18n ?? ((key) => key);
  const resolvedMcpPath = mcpApiPath ?? inferMcpPath(apiPath);
  const resolvedTestPath = testApiPath ?? joinApiPath(settingsApiPath, 'test');
  const settingsApi = useAiSettings({ settingsApiPath });
  const status = useToolStatus(settingsApi.settings, resolvedMcpPath);
  const Trigger = slots?.Trigger ?? DefaultTrigger;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isEditable = target?.tagName === 'INPUT' || target?.tagName === 'TEXTAREA' || target?.isContentEditable;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setOpen((value) => !value);
      }

      if (event.key === 'Escape' && !isEditable) {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const normalizedSuggestions = useMemo(() => normalizeSuggestions(suggestions), [suggestions]);
  const cssVars = {
    '--ncb-primary': theme?.primary ?? '#2563eb',
    '--ncb-radius': theme?.radius ?? '8px',
    '--ncb-accent': theme?.accent ?? theme?.primary ?? '#2563eb',
    '--ncb-code-bg': theme?.codeBg ?? '#0b1020',
    ...style,
  } as CSSProperties;

  return (
    <div className={className} style={cssVars}>
      <Trigger open={open} status={status} onToggle={() => setOpen((value) => !value)} t={t} />

      {open && (
        <div
          className={cn(
            'fixed z-50',
            isCoarse
              ? 'inset-x-0 bottom-0 h-[70dvh] w-full max-h-[70dvh] rounded-t-xl'
              : cn(sizeClasses[size], 'max-[640px]:inset-x-3 max-[640px]:bottom-20 max-[640px]:top-auto max-[640px]:h-[calc(100dvh-6rem)] max-[640px]:w-auto max-[640px]:max-w-none'),
          )}
        >
          <ChatPanel
            apiPath={apiPath}
            settingsApiPath={settingsApiPath}
            mcpApiPath={resolvedMcpPath}
            testApiPath={resolvedTestPath}
            sessionKey={sessionKey}
            normalizedSuggestions={normalizedSuggestions}
            slots={slots as Partial<ChatbotSlots> | undefined}
            panelClassName={panelClassName}
            size={size}
            onSizeChange={setSize}
            t={t}
            onClose={() => setOpen(false)}
          />
        </div>
      )}
    </div>
  );
}

export default Chatbot;
