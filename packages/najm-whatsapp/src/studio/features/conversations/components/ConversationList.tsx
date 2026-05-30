import React from 'react';
import { Pin, BellOff, Archive } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Conversation } from '@/features/conversations/types';

interface ConversationListProps {
  conversations: Conversation[];
  selectedJid?: string | null;
  onSelect: (jid: string) => void;
}

export function ConversationList({ conversations, selectedJid, onSelect }: ConversationListProps) {
  return (
    <div className="flex flex-col gap-1 overflow-y-auto">
      {conversations.map((conv) => (
        <button
          key={conv.jid}
          onClick={() => onSelect(conv.jid)}
          className={cn(
            'flex flex-col gap-1 rounded-md px-3 py-2 text-left transition-colors',
            selectedJid === conv.jid
              ? 'bg-surface text-txt-primary'
              : 'hover:bg-card-hover text-txt-secondary'
          )}
        >
          <div className="flex items-center justify-between">
            <span className="truncate text-sm font-medium text-txt-primary">{conv.name || conv.jid}</span>
            <div className="flex items-center gap-1">
              {conv.isPinned && <Pin size={12} className="text-brand" />}
              {conv.isMuted && <BellOff size={12} className="text-txt-muted" />}
              {conv.isArchived && <Archive size={12} className="text-txt-muted" />}
              {conv.unreadCount > 0 && (
                <span className="rounded-full bg-brand px-1.5 py-0.5 text-[10px] font-medium text-white">
                  {conv.unreadCount}
                </span>
              )}
            </div>
          </div>
          {conv.lastMessage && (
            <span className="truncate text-xs text-txt-muted">{conv.lastMessage}</span>
          )}
        </button>
      ))}
    </div>
  );
}
