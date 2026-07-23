import React, { useEffect, useMemo, useState } from 'react';
import { Search, MessageSquareText } from 'lucide-react';
import { useApiClient } from '@/lib/api';
import { useSelectedInstance } from '@/shared/hooks/useSelectedInstance';
import { ConversationList } from './ConversationList';
import { MessageThread } from '@/features/messages/components/MessageThread';
import { SendMessageForm } from '@/features/messages/components/SendMessageForm';
import { cn } from '@/lib/utils';
import type { Conversation, Message } from '@/features/conversations/types';
import { NEmptyState, Input } from 'najm-kit';

interface ConversationsViewProps {
  onSelectConversation?: (jid: string | null) => void;
  selectedJid?: string | null;
}

export function ConversationsView({ onSelectConversation, selectedJid }: ConversationsViewProps) {
  const api = useApiClient();
  const { instanceId } = useSelectedInstance();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [query, setQuery] = useState('');
  const [loadingConvos, setLoadingConvos] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);

  async function fetchConversations() {
    if (!instanceId) return;
    setLoadingConvos(true);
    try {
      const data = await api.get(`/conversations/${instanceId}`);
      setConversations(data || []);
    } finally {
      setLoadingConvos(false);
    }
  }

  async function fetchMessages(jid: string) {
    if (!instanceId || !jid) return;
    setLoadingMessages(true);
    try {
      const data = await api.get(`/messages/${instanceId}/${jid}?limit=50`);
      setMessages(data || []);
    } finally {
      setLoadingMessages(false);
    }
  }

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 10000);
    return () => clearInterval(interval);
  }, [api, instanceId]);

  useEffect(() => {
    if (!selectedJid) {
      setMessages([]);
      return;
    }
    fetchMessages(selectedJid);
    const interval = setInterval(() => fetchMessages(selectedJid), 5000);
    return () => clearInterval(interval);
  }, [api, instanceId, selectedJid]);

  const filtered = useMemo(() => {
    if (!query.trim()) return conversations;
    const q = query.toLowerCase();
    return conversations.filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.jid.toLowerCase().includes(q) ||
        c.lastMessage?.toLowerCase().includes(q)
    );
  }, [conversations, query]);

  const selectedConversation = conversations.find((c) => c.jid === selectedJid);

  return (
    <div className="flex h-full flex-col">
      {!instanceId ? (
        <NEmptyState
          icon={MessageSquareText}
          title="No instance selected"
          description="Select an instance to view conversations."
        />
      ) : (
        <div className="flex h-full flex-col sm:flex-row">
          {/* Left: Conversation List */}
          <div
            className={cn(
              'flex h-full w-full flex-col border-r border-border bg-sidebar sm:w-72 lg:w-80',
              selectedJid && 'hidden sm:flex'
            )}
          >
            <div className="flex items-center justify-between border-b border-border px-4 py-3">
              <h2 className="text-sm font-semibold text-txt-primary">Conversations</h2>
            </div>
            <div className="p-3">
              <div className="relative">
                <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-txt-muted" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search..."
                  className="pl-9"
                />
              </div>
            </div>
            <div className="flex-1 overflow-hidden px-2 pb-2">
              {loadingConvos && conversations.length === 0 ? (
                <div className="px-4 py-3 text-xs text-txt-muted">Loading...</div>
              ) : (
                <ConversationList
                  conversations={filtered}
                  selectedJid={selectedJid}
                  onSelect={(jid) => onSelectConversation?.(jid)}
                />
              )}
            </div>
          </div>

          {/* Right: Message Canvas */}
          <div className={cn('flex flex-1 flex-col', !selectedJid && 'hidden sm:flex')}>
            {!selectedJid ? (
              <NEmptyState
                icon={MessageSquareText}
                title="Select a conversation"
                description="Choose a chat from the list to view messages."
              />
            ) : (
              <>
                {/* Header */}
                <div className="flex items-center gap-3 border-b border-border px-4 py-3">
                  <button
                    onClick={() => onSelectConversation?.(null)}
                    className="rounded-md p-1 text-txt-muted hover:bg-surface hover:text-txt-primary sm:hidden"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m15 18-6-6 6-6"/></svg>
                  </button>
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-txt-primary">
                      {selectedConversation?.name || selectedJid}
                    </span>
                    <span className="text-[10px] text-txt-muted">{selectedJid}</span>
                  </div>
                </div>

                {/* Messages */}
                {loadingMessages && messages.length === 0 ? (
                  <div className="flex flex-1 items-center justify-center text-xs text-txt-muted">
                    Loading messages...
                  </div>
                ) : (
                  <MessageThread messages={messages} />
                )}

                {/* Input */}
                <SendMessageForm instanceId={instanceId} jid={selectedJid} onSent={() => fetchMessages(selectedJid)} />
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
