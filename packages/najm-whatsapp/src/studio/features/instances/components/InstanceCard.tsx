import React from 'react';
import { Power, PowerOff, Trash2, QrCode, RotateCcw, MessageSquare, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from 'najm-kit';
import type { Instance } from '@/features/instances/types';

interface InstanceCardProps {
  instance: Instance;
  selected?: boolean;
  onSelect?: (id: string) => void;
  onConnect: (id: string) => void;
  onDisconnect: (id: string) => void;
  onRestart: (id: string) => void;
  onDelete: (id: string) => void;
  onShowQr: (id: string) => void;
}

const statusConfig: Record<string, { bg: string; text: string; dot: string; label: string }> = {
  connected: {
    bg: 'bg-status-green/10',
    text: 'text-status-green',
    dot: 'bg-status-green',
    label: 'Connected',
  },
  connecting: {
    bg: 'bg-status-yellow/10',
    text: 'text-status-yellow',
    dot: 'bg-status-yellow',
    label: 'Connecting',
  },
  disconnected: {
    bg: 'bg-txt-muted/10',
    text: 'text-txt-muted',
    dot: 'bg-txt-muted',
    label: 'Disconnected',
  },
  error: {
    bg: 'bg-status-red/10',
    text: 'text-status-red',
    dot: 'bg-status-red',
    label: 'Error',
  },
};

export function InstanceCard({
  instance,
  selected,
  onSelect,
  onConnect,
  onDisconnect,
  onRestart,
  onDelete,
  onShowQr,
}: InstanceCardProps) {
  const status = statusConfig[instance.status] || statusConfig.disconnected;
  const messageCount = instance.messageCount ?? 0;
  const contactCount = instance.contactCount ?? 0;

  return (
    <div
      onClick={() => onSelect?.(instance.id)}
      className={cn(
        'flex flex-col gap-3 rounded-xl border p-4 transition-all duration-150 cursor-pointer',
        selected
          ? 'border-brand/40 bg-brand/5 shadow-brand-glow'
          : 'border-border bg-card hover:border-border-subtle hover:bg-card-hover'
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        {/* Avatar */}
        <div className="relative shrink-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-surface text-sm font-bold text-txt-primary">
            {instance.name.charAt(0).toUpperCase()}
          </div>
          <span
            className={cn(
              'absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card',
              status.dot
            )}
          />
        </div>

        {/* Name + Badge */}
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-semibold text-txt-primary">{instance.name}</span>
            <span className="shrink-0 rounded bg-brand/10 px-1.5 py-0 text-[10px] font-medium uppercase text-brand">
              BAILEYS
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className={cn('h-1.5 w-1.5 rounded-full', status.dot)} />
            <span className={cn('text-[10px] font-semibold uppercase', status.text)}>
              {status.label}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div className="flex shrink-0 items-center gap-1">
          {instance.status === 'connected' ? (
            <button
              onClick={(e) => { e.stopPropagation(); onDisconnect(instance.id); }}
              className="flex h-7 w-7 items-center justify-center rounded-md text-status-red hover:bg-status-red/10"
              title="Disconnect"
            >
              <PowerOff size={14} />
            </button>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); onConnect(instance.id); }}
              className="flex h-7 w-7 items-center justify-center rounded-md text-status-green hover:bg-status-green/10"
              title="Connect"
            >
              <Power size={14} />
            </button>
          )}
          <button
            onClick={(e) => { e.stopPropagation(); onRestart(instance.id); }}
            className="flex h-7 w-7 items-center justify-center rounded-md text-txt-muted hover:bg-surface hover:text-txt-primary"
            title="Restart"
          >
            <RotateCcw size={14} />
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDelete(instance.id); }}
            className="flex h-7 w-7 items-center justify-center rounded-md text-status-red hover:bg-status-red/10"
            title="Delete"
          >
            <Trash2 size={14} />
          </button>

        </div>
      </div>

      {/* Inline meta */}
      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-txt-secondary">
        <span className="flex items-center gap-1">
          <MessageSquare size={12} className="text-txt-muted" />
          {messageCount > 0 ? `${messageCount.toLocaleString()} msgs` : '—'}
        </span>
        <span className="flex items-center gap-1">
          <Users size={12} className="text-txt-muted" />
          {contactCount > 0 ? `${contactCount.toLocaleString()} contacts` : '—'}
        </span>
        {instance.phone && (
          <span className="font-mono text-txt-muted">{instance.phone}</span>
        )}
      </div>

      {/* QR button when connecting */}
      {instance.status === 'connecting' && (
        <Button
          size="sm"
          variant="outline"
          onClick={(e) => { e.stopPropagation(); onShowQr(instance.id); }}
          className="w-fit gap-1.5 self-start"
        >
          <QrCode className="h-3.5 w-3.5" />
          QR
        </Button>
      )}
    </div>
  );
}
