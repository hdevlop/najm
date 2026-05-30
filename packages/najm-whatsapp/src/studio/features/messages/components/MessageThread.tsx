import React, { useEffect, useMemo, useRef } from 'react';
import { List, type RowComponentProps } from 'react-window';
import { Check, CheckCheck, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Message } from '@/features/conversations/types';

interface MessageThreadProps {
  messages: Message[];
}

type Row =
  | { type: 'separator'; key: string; label: string }
  | { type: 'message'; key: string; msg: Message };

function dayLabel(iso: string): string {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);

  const sameDay = (a: Date, b: Date) =>
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate();

  if (sameDay(d, today)) return 'Today';
  if (sameDay(d, yesterday)) return 'Yesterday';
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function dayKey(iso: string): string {
  const d = new Date(iso);
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

function buildRows(messages: Message[]): Row[] {
  const rows: Row[] = [];
  let lastKey: string | null = null;
  for (const msg of messages) {
    const key = dayKey(msg.timestamp);
    if (key !== lastKey) {
      rows.push({ type: 'separator', key: `sep-${key}`, label: dayLabel(msg.timestamp) });
      lastKey = key;
    }
    rows.push({ type: 'message', key: msg.id, msg });
  }
  return rows;
}

function StatusIcon({ status }: { status?: Message['status'] }) {
  if (!status || status === 'pending') return <Clock size={10} className="text-txt-muted" />;
  if (status === 'sent') return <Check size={10} className="text-txt-muted" />;
  if (status === 'delivered') return <CheckCheck size={10} className="text-txt-muted" />;
  if (status === 'read') return <CheckCheck size={10} className="text-brand" />;
  return null;
}

interface RowProps {
  rows: Row[];
}

function RowRenderer({ index, style, rows }: RowComponentProps<RowProps>) {
  const row = rows[index];
  if (row.type === 'separator') {
    return (
      <div style={style} className="flex items-center justify-center px-2 py-2">
        <span className="rounded-full bg-surface px-3 py-0.5 text-[10px] font-medium uppercase tracking-wider text-txt-muted">
          {row.label}
        </span>
      </div>
    );
  }
  const msg = row.msg;
  return (
    <div style={style} className="px-3 py-1">
      <div
        className={cn(
          'flex max-w-[85%] flex-col rounded-2xl px-3.5 py-2 text-xs leading-relaxed',
          msg.fromMe
            ? 'ml-auto bg-brand text-white rounded-br-md'
            : 'mr-auto bg-surface text-txt-primary rounded-bl-md',
        )}
      >
        <span className="whitespace-pre-wrap break-words">{msg.text}</span>
        <div
          className={cn(
            'mt-1 flex items-center justify-end gap-1',
            msg.fromMe ? 'text-white/70' : 'text-txt-muted'
          )}
        >
          <span className="text-[10px]">
            {new Date(msg.timestamp).toLocaleTimeString([], {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
          {msg.fromMe && <StatusIcon status={msg.status} />}
        </div>
      </div>
    </div>
  );
}

const SEPARATOR_HEIGHT = 32;
const MESSAGE_HEIGHT = 72;

export function MessageThread({ messages }: MessageThreadProps) {
  const rows = useMemo(() => buildRows(messages), [messages]);
  const listRef = useRef<{
    scrollToRow: (config: {
      index: number;
      behavior?: 'auto' | 'instant' | 'smooth';
      align?: 'auto' | 'center' | 'end' | 'smart' | 'start';
    }) => void;
    get element(): HTMLDivElement | null;
  } | null>(null);

  useEffect(() => {
    if (rows.length === 0) return;
    const reduceMotion =
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    listRef.current?.scrollToRow({
      index: rows.length - 1,
      align: 'end',
      behavior: reduceMotion ? 'instant' : 'smooth',
    });
  }, [rows.length]);

  if (rows.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center text-xs text-txt-muted">
        No messages yet.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-hidden">
      <List<RowProps>
        listRef={listRef as any}
        rowCount={rows.length}
        rowHeight={(index) =>
          rows[index].type === 'separator' ? SEPARATOR_HEIGHT : MESSAGE_HEIGHT
        }
        rowComponent={RowRenderer}
        rowProps={{ rows }}
        overscanCount={8}
        style={{ height: '100%' }}
      />
    </div>
  );
}
