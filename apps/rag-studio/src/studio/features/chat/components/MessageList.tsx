import React, { useRef, useEffect } from 'react';
import type { ChatMessage } from '@/features/chat/types';
import { UserMessage } from './UserMessage';
import { AIMessage } from './AIMessage';

interface MessageListProps {
  messages: ChatMessage[];
  onCitationClick?: (chunkId: string, documentId: string) => void;
}

export function MessageList({ messages, onCitationClick }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-txt-muted">
        <svg className="h-12 w-12 mb-4 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>
        <p className="text-sm">Ask a question about your knowledge base</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {messages.map((msg) =>
        msg.role === 'user' ? (
          <UserMessage key={msg.id} content={msg.content} />
        ) : (
          <AIMessage
            key={msg.id}
            content={msg.content}
            citations={msg.citations}
            onCitationClick={onCitationClick}
          />
        )
      )}
      <div ref={bottomRef} />
    </div>
  );
}
