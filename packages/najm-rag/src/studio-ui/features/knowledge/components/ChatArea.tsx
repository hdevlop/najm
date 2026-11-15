import React, { useRef, useEffect } from 'react';
import { MessageSquare, Send, Sparkles } from 'lucide-react';
import { Button, NEmptyState, NPageHeader, Textarea, cn } from 'najm-kit';

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  citations?: Array<{
    chunkId: string;
    documentId: string;
    text: string;
    score: number;
    ordinal: number;
  }>;
  timestamp: string;
}

interface ChatAreaProps {
  messages: ChatMessage[];
  onSend: (content: string) => void;
  loading?: boolean;
  onCitationClick?: (chunkId: string, documentId: string) => void;
}

export function ChatArea({ messages, onSend, loading, onCitationClick }: ChatAreaProps) {
  const [input, setInput] = React.useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleSend = () => {
    const text = input.trim();
    if (!text || loading) return;
    onSend(text);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col">
      <NPageHeader
        icon={MessageSquare}
        title="Knowledge Chat"
        subtitle="Ask questions answered from your indexed documents"
      />
      <div className="min-h-0 flex-1 space-y-5 overflow-y-auto p-4 xl:p-5">
        {messages.length === 0 && !loading && (
          <div className="flex h-full items-center justify-center">
            <NEmptyState
              icon={Sparkles}
              title="Ask a question about your knowledge base"
              description="Your documents will be searched and cited automatically."
            />
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            {msg.role === 'user' ? (
              <div className="max-w-[75%] rounded-2xl rounded-tr-sm bg-brand px-4 py-2.5 text-sm leading-relaxed text-primary-foreground">
                {msg.content}
              </div>
            ) : (
              <div className="flex max-w-[80%] flex-col gap-2">
                <div className="rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3 text-sm leading-relaxed text-txt-primary">
                  {msg.content}
                </div>
                {msg.citations && msg.citations.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pl-1">
                    {msg.citations.map((c, i) => (
                      <Button
                        key={`${c.chunkId}-${i}`}
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={() => onCitationClick?.(c.chunkId, c.documentId)}
                        className="h-7 gap-1.5 rounded-full px-2.5 text-brand"
                      >
                        <span className="font-semibold tabular-nums">[{i + 1}]</span>
                        Citation
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex justify-start" role="status" aria-live="polite">
            <div className="flex max-w-[80%] items-center gap-2 rounded-2xl rounded-tl-sm border border-border bg-card px-4 py-3 text-sm text-txt-secondary">
              <span className="flex gap-1" aria-hidden="true">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-txt-secondary [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-txt-secondary [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-txt-secondary" />
              </span>
              Searching documents…
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="shrink-0 border-t border-border bg-background p-4">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <Textarea
            ref={textareaRef}
            aria-label="Message"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your knowledge base…"
            className="max-h-[120px] min-h-[44px] flex-1 resize-none text-sm"
            rows={1}
          />
          <Button size="icon" onClick={handleSend} disabled={!input.trim() || loading} aria-label="Send message" className="h-11 w-11 shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
