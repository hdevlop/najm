'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import type { UIMessage } from 'ai';
import {
  AlertCircle,
  Bot,
  Check,
  Clipboard,
  Copy,
  Coins,
  FileSearch,
  MessagesSquare,
  PenLine,
  Sparkles,
  UserRound,
  Wrench,
} from 'lucide-react';
import { cn } from '../lib/cn';
import { MarkdownMessage } from './MarkdownMessage';
import type { ChatbotSuggestion, ChatbotSlots, EmptyStateSlotProps, I18nFn, MessageSlotProps } from '../types';

interface ChatMessagesProps {
  messages: UIMessage[];
  isLoading: boolean;
  error?: string | null;
  suggestions: ChatbotSuggestion[];
  slots?: Partial<ChatbotSlots>;
  t: I18nFn;
  onSuggestion: (text: string) => void;
}

const DEFAULT_ICONS = [FileSearch, MessagesSquare, PenLine, Sparkles];

export function getMessageText(message: UIMessage): string {
  if (message.parts?.length) {
    return message.parts
      .filter((part) => part.type === 'text')
      .map((part) => (part as { text?: string }).text ?? '')
      .join('');
  }
  return typeof message.content === 'string' ? message.content : '';
}

function getToolParts(message: UIMessage) {
  return message.parts?.filter((part) => part.type === 'tool-invocation') ?? [];
}

interface TokenUsageAnnotation {
  type: 'token-usage';
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  inputCost: number;
  outputCost: number;
  totalCost: number;
  currency: 'USD';
  pricingFound: boolean;
  provider?: string;
  model?: string;
}

function getTokenUsage(message: UIMessage): TokenUsageAnnotation | null {
  const annotations = (message as { annotations?: unknown[] }).annotations;
  if (!Array.isArray(annotations)) return null;
  for (const ann of annotations) {
    if (ann && typeof ann === 'object' && (ann as { type?: string }).type === 'token-usage') {
      return ann as TokenUsageAnnotation;
    }
  }
  return null;
}

function formatTokens(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`;
  return String(n);
}

function formatCost(usd: number): string {
  if (usd === 0) return '$0';
  if (usd < 0.0001) return `<$0.0001`;
  if (usd < 0.01) return `$${usd.toFixed(5)}`;
  if (usd < 1) return `$${usd.toFixed(4)}`;
  return `$${usd.toFixed(2)}`;
}

function UsageBadge({ usage }: { usage: TokenUsageAnnotation }) {
  const title = [
    `Input: ${usage.promptTokens.toLocaleString()} tokens${usage.pricingFound ? ` (${formatCost(usage.inputCost)})` : ''}`,
    `Output: ${usage.completionTokens.toLocaleString()} tokens${usage.pricingFound ? ` (${formatCost(usage.outputCost)})` : ''}`,
    usage.model ? `Model: ${usage.model}` : null,
    !usage.pricingFound ? 'No pricing data for this model' : null,
  ].filter(Boolean).join('\n');

  return (
    <div
      className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-zinc-200 bg-zinc-50 px-2 py-0.5 text-[10px] font-medium text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
      title={title}
    >
      <Coins className="h-3 w-3" />
      <span>{formatTokens(usage.totalTokens)} tokens</span>
      {usage.pricingFound && (
        <>
          <span className="text-zinc-300 dark:text-zinc-700">·</span>
          <span>{formatCost(usage.totalCost)}</span>
        </>
      )}
    </div>
  );
}

function DefaultEmptyState({ suggestions, onSuggestion, t }: EmptyStateSlotProps) {
  return (
    <div className="flex h-full flex-col justify-between overflow-y-auto px-4 py-5">
      <div className="mx-auto flex max-w-[280px] flex-col items-center pt-5 text-center">
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-[var(--ncb-radius)] bg-[var(--ncb-primary)] text-white shadow-lg shadow-black/10">
          <Sparkles className="h-6 w-6" />
        </div>
        <p className="text-base font-semibold text-zinc-950 dark:text-white">{t('Ready when you are')}</p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        {suggestions.map((suggestion, index) => {
          const Icon = suggestion.icon ?? DEFAULT_ICONS[index % DEFAULT_ICONS.length];
          return (
            <button
              key={`${suggestion.label}-${index}`}
              type="button"
              onClick={() => onSuggestion(suggestion.text)}
              className="group flex min-h-24 flex-col items-start gap-3 rounded-[var(--ncb-radius)] border border-zinc-200 bg-white p-3 text-left text-zinc-950 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--ncb-primary)] hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950 dark:text-white"
            >
              <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-zinc-100 text-[var(--ncb-primary)] transition group-hover:bg-[var(--ncb-primary)] group-hover:text-white dark:bg-zinc-900">
                <Icon className="h-4 w-4" />
              </span>
              <span className="text-xs font-semibold leading-4">{t(suggestion.label)}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function ToolPills({ message }: { message: UIMessage }) {
  const toolParts = getToolParts(message);
  if (!toolParts.length) return null;

  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {toolParts.map((part: any, index) => {
        const invocation = part.toolInvocation;
        const toolName = invocation?.toolName ?? part.toolName ?? 'tool';
        const isDone = invocation?.state === 'result' || Boolean(invocation?.result);
        return (
          <span
            key={invocation?.toolCallId ?? `${toolName}-${index}`}
            className={cn(
              'inline-flex max-w-full items-center gap-1 rounded-full border px-2 py-1 text-[11px] leading-none',
              isDone
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300'
                : 'border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950 dark:text-amber-300',
            )}
          >
            <Wrench className="h-3 w-3 shrink-0" />
            <span className="truncate">{toolName.replace(/_/g, ' ')}</span>
          </span>
        );
      })}
    </div>
  );
}

function DefaultMessage({ message, text, isAssistant, children, onCopy, t }: MessageSlotProps) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await onCopy();
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className={cn('flex gap-2.5', isAssistant ? 'justify-start' : 'justify-end')}>
      {isAssistant && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-zinc-200 bg-white text-[var(--ncb-primary)] dark:border-zinc-800 dark:bg-zinc-950">
          <Bot className="h-4 w-4" />
        </div>
      )}

      <div
        className={cn(
          'group relative max-w-[82%] rounded-[var(--ncb-radius)] px-3.5 py-3 text-sm leading-6 shadow-sm',
          isAssistant
            ? 'border border-zinc-200 bg-white text-zinc-950 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-50'
            : 'bg-[var(--ncb-primary)] text-white',
        )}
      >
        {children}
        {isAssistant && <ToolPills message={message} />}
        {isAssistant && (() => {
          const usage = getTokenUsage(message);
          return usage ? <UsageBadge usage={usage} /> : null;
        })()}
        {text && (
          <button
            type="button"
            onClick={copy}
            className="absolute -right-2 -top-2 hidden h-7 w-7 items-center justify-center rounded-full border border-zinc-200 bg-white text-zinc-600 shadow-sm transition hover:text-zinc-950 group-hover:inline-flex dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300"
            title={copied ? t('Copied') : t('Copy')}
          >
            {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
          </button>
        )}
      </div>

      {!isAssistant && (
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-zinc-900 text-white dark:bg-zinc-100 dark:text-zinc-950">
          <UserRound className="h-4 w-4" />
        </div>
      )}
    </div>
  );
}

export function ChatMessages({
  messages,
  isLoading,
  error,
  suggestions,
  slots,
  t,
  onSuggestion,
}: ChatMessagesProps) {
  const bottomRef = useRef<HTMLDivElement>(null);
  const EmptyState = slots?.EmptyState ?? DefaultEmptyState;
  const Message = slots?.Message ?? DefaultMessage;

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' });
  }, [messages, isLoading]);

  const visibleMessages = useMemo(() => messages.filter((message) => (
    getMessageText(message) || getToolParts(message).length > 0
  )), [messages]);

  if (visibleMessages.length === 0) {
    return (
      <div className="min-h-0 flex-1">
        <EmptyState suggestions={suggestions} onSuggestion={onSuggestion} t={t} />
      </div>
    );
  }

  return (
    <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
      <div className="space-y-4">
        {visibleMessages.map((message) => {
          const text = getMessageText(message);
          const isAssistant = message.role === 'assistant';
          return (
            <Message
              key={message.id}
              message={message}
              text={text}
              isAssistant={isAssistant}
              onCopy={() => navigator.clipboard?.writeText(text)}
              t={t}
            >
              {text ? (
                isAssistant ? <MarkdownMessage text={text} /> : <span className="whitespace-pre-wrap break-words">{text}</span>
              ) : null}
            </Message>
          );
        })}

        {error && (
          <div className="rounded-[var(--ncb-radius)] border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950 dark:text-red-300">
            <div className="flex gap-2">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="break-words">{error}</span>
            </div>
          </div>
        )}

        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            <Clipboard className="h-4 w-4 animate-pulse text-[var(--ncb-primary)]" />
            <span className="inline-flex gap-1">
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:120ms]" />
              <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-current [animation-delay:240ms]" />
            </span>
          </div>
        )}
      </div>
      <div ref={bottomRef} />
    </div>
  );
}
