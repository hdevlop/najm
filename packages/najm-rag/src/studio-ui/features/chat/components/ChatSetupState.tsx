import React from 'react';
import { AlertCircle, CheckCircle2, XCircle } from 'lucide-react';
import { Button } from 'najm-kit';
import type { StudioChatDebugError } from '@/features/chat/types';

interface ChatSetupStateProps {
  error: StudioChatDebugError;
  onOpenSettings?: () => void;
}

export function ChatSetupState({ error, onOpenSettings }: ChatSetupStateProps) {
  const items = [
    { label: 'AI assistant enabled', ok: error.code !== 'AI_DISABLED' },
    { label: 'Provider selected', ok: !error.setup?.needsProvider },
    { label: 'Model selected', ok: !error.setup?.needsModel },
    { label: 'API key / base URL configured', ok: !error.setup?.needsApiKey },
  ];

  return (
    <div className="flex flex-col items-center justify-center h-full p-8">
      <div className="max-w-md w-full space-y-5">
        <div className="flex items-start gap-3">
          <AlertCircle className="h-5 w-5 text-status-red shrink-0 mt-0.5" />
          <div>
            <h3 className="text-sm font-semibold text-txt-primary">{error.error}</h3>
            <p className="text-xs text-txt-muted mt-1">Code: {error.code}</p>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 space-y-3">
          <h4 className="text-xs font-semibold text-txt-muted uppercase tracking-wider">Setup Checklist</h4>
          <div className="space-y-2">
            {items.map((item) => (
              <div key={item.label} className="flex items-center gap-2 text-sm">
                {item.ok ? (
                  <CheckCircle2 className="h-4 w-4 text-status-green shrink-0" />
                ) : (
                  <XCircle className="h-4 w-4 text-status-red shrink-0" />
                )}
                <span className={item.ok ? 'text-txt-secondary' : 'text-txt-primary'}>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {onOpenSettings && (
          <Button onClick={onOpenSettings} className="w-full">
            Open Chatbot Settings
          </Button>
        )}
      </div>
    </div>
  );
}
