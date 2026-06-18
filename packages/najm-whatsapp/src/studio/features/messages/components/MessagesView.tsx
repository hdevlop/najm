import React, { useEffect, useState } from 'react';
import { ArrowLeft } from 'lucide-react';
import { Button } from 'najm-kit';
import { useApiClient } from '@/lib/api';
import { useSelectedInstance } from '@/shared/hooks/useSelectedInstance';
import { MessageThread } from './MessageThread';
import { SendMessageForm } from './SendMessageForm';
import type { Message } from '@/features/conversations/types';

interface MessagesViewProps {
  jid: string;
  onBack?: () => void;
}

export function MessagesView({ jid, onBack }: MessagesViewProps) {
  const api = useApiClient();
  const { instanceId } = useSelectedInstance();
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  async function fetchMessages() {
    if (!instanceId || !jid) return;
    setLoading(true);
    try {
      const data = await api.get(`/messages/${instanceId}/${jid}?limit=50`);
      setMessages(data);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchMessages();
    if (!instanceId || !jid) return;
    const interval = setInterval(fetchMessages, 5000);
    return () => clearInterval(interval);
  }, [api, instanceId, jid]);

  if (!instanceId) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-txt-muted">
        Select an instance first.
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center gap-2 border-b border-border px-4 py-3">
        {onBack && (
          <Button variant="ghost" size="icon" onClick={onBack} aria-label="Back to conversations" className="h-8 w-8">
            <ArrowLeft size={18} />
          </Button>
        )}
        <span className="text-sm font-medium text-txt-primary">{jid}</span>
      </div>
      {loading && messages.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-xs text-txt-muted">
          Loading messages...
        </div>
      ) : (
        <MessageThread messages={messages} />
      )}
      <SendMessageForm instanceId={instanceId} jid={jid} onSent={fetchMessages} />
    </div>
  );
}
