'use client';

import { ArrowLeft, Maximize2, Minimize2, Settings, Sparkles, Trash2, X } from 'lucide-react';
import { AiSettingsForm } from './AiSettingsForm';
import { ChatInput } from './ChatInput';
import { ChatMessages } from './ChatMessages';
import { useChatPanel } from '../hooks/useChatPanel';
import { cn } from '../lib/cn';
import type { ChatbotProps, ChatbotSize, ChatbotSlots, ChatbotStatus, ChatbotSuggestion, HeaderSlotProps, I18nFn } from '../types';

const SIZE_CYCLE: ChatbotSize[] = ['sm', 'md', 'lg', 'xl'];
const sizeLabel: Record<ChatbotSize, string> = { sm: 'S', md: 'M', lg: 'L', xl: 'XL' };

export interface ChatPanelProps extends Required<Pick<ChatbotProps, 'apiPath' | 'settingsApiPath' | 'mcpApiPath'>> {
  normalizedSuggestions: ChatbotSuggestion[];
  testApiPath?: string;
  sessionKey?: string;
  slots?: Partial<ChatbotSlots>;
  panelClassName?: string;
  size: ChatbotSize;
  onSizeChange: (size: ChatbotSize) => void;
  t: I18nFn;
  onClose: () => void;
}

const statusText: Record<ChatbotStatus, string> = {
  ready: 'Ready',
  'empty-tools': 'No tools',
  disabled: 'Disabled',
};

function DefaultHeader({
  view,
  settings,
  status,
  hasMessages,
  size,
  onClose,
  onClear,
  onViewChange,
  onSizeChange,
  t,
}: HeaderSlotProps) {
  const nextSize = SIZE_CYCLE[(SIZE_CYCLE.indexOf(size) + 1) % SIZE_CYCLE.length];
  const isMax = size === 'xl';
  return (
    <div className="flex shrink-0 items-center justify-between border-b border-[var(--ncb-primary)]/20 bg-[var(--ncb-primary)] px-4 py-3.5 text-white">
      <div className="flex min-w-0 items-center gap-3">
        <div className="relative shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-[var(--ncb-radius)] bg-white/15 ring-1 ring-white/20">
            <Sparkles className="h-4 w-4" />
          </div>
          <span
            className={cn(
              'absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full ring-2 ring-[var(--ncb-primary)]',
              status === 'ready' ? 'bg-emerald-400' : status === 'empty-tools' ? 'bg-amber-400' : 'bg-zinc-400',
            )}
          />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold leading-tight">{t('AI Assistant')}</p>
          <p className="mt-0.5 truncate text-xs text-white/75">
            {settings ? `${settings.provider} · ${settings.model}` : t(statusText[status])}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1">
        {view === 'chat' && hasMessages && (
          <button
            type="button"
            onClick={onClear}
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/85 transition hover:bg-white/15 hover:text-white"
            title={t('Clear chat')}
          >
            <Trash2 className="h-4 w-4" />
          </button>
        )}
        <button
          type="button"
          onClick={() => onSizeChange(nextSize)}
          className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-[11px] font-semibold text-white/85 transition hover:bg-white/15 hover:text-white"
          title={t('Resize')}
          aria-label={t('Resize')}
        >
          {isMax ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
          <span className="tabular-nums">{sizeLabel[size]}</span>
        </button>
        <button
          type="button"
          onClick={() => onViewChange(view === 'settings' ? 'chat' : 'settings')}
          className={cn(
            'inline-flex h-8 w-8 items-center justify-center rounded-md text-white/85 transition hover:bg-white/15 hover:text-white',
            view === 'settings' && 'bg-white/20 text-white',
          )}
          title={view === 'settings' ? t('Back to chat') : t('Settings')}
          aria-label={view === 'settings' ? t('Back to chat') : t('Settings')}
        >
          {view === 'settings' ? <ArrowLeft className="h-4 w-4" /> : <Settings className="h-4 w-4" />}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="inline-flex h-8 w-8 items-center justify-center rounded-md text-white/85 transition hover:bg-white/15 hover:text-white"
          title={t('Close')}
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}

export function ChatPanel({
  apiPath,
  settingsApiPath,
  mcpApiPath,
  testApiPath,
  sessionKey,
  normalizedSuggestions,
  slots,
  panelClassName,
  size,
  onSizeChange,
  t,
  onClose,
}: ChatPanelProps) {
  const panel = useChatPanel({ apiPath, settingsApiPath, mcpApiPath, sessionKey });
  const Header = slots?.Header ?? DefaultHeader;

  return (
    <div
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden rounded-[var(--ncb-radius)] border border-zinc-200 bg-white shadow-[0_24px_80px_-24px_rgba(15,23,42,0.48)] dark:border-zinc-800 dark:bg-zinc-950 dark:shadow-[0_24px_80px_-24px_rgba(0,0,0,0.9)]',
        panelClassName,
      )}
    >
      <Header
        view={panel.view}
        settings={panel.settingsRecord}
        status={panel.status}
        hasMessages={panel.messages.length > 0}
        size={size}
        onClose={onClose}
        onClear={panel.clearMessages}
        onViewChange={panel.setView}
        onSizeChange={onSizeChange}
        t={t}
      />

      {panel.view === 'settings' ? (
        <AiSettingsForm settingsApi={panel.settingsApi} testApiPath={testApiPath} t={t} />
      ) : (
        <>
          <ChatMessages
            messages={panel.messages}
            isLoading={panel.isLoading}
            error={panel.chatError}
            suggestions={normalizedSuggestions}
            slots={slots}
            t={t}
            onSuggestion={panel.handleSuggestion}
          />
          <ChatInput
            input={panel.input}
            isLoading={panel.isLoading}
            onChange={panel.setInput}
            onSubmit={panel.handleSubmit}
            onStop={panel.stop}
            slots={slots}
            t={t}
          />
        </>
      )}
    </div>
  );
}
