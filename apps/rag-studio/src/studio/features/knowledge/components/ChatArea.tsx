import React, { useRef, useEffect } from 'react';
import { Send, Sparkles } from 'lucide-react';
import { Textarea } from 'najm-kit';
import { Button } from 'najm-kit';
import { cn } from '@/lib/utils';

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
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-5 space-y-5">
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-txt-muted">
            <div className="h-14 w-14 rounded-2xl bg-brand/10 flex items-center justify-center mb-4">
              <Sparkles className="h-7 w-7 text-brand/60" />
            </div>
            <p className="text-sm font-medium text-txt-secondary">Ask a question about your knowledge base</p>
            <p className="text-sm text-txt-muted mt-1">Your documents will be searched and cited automatically</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={cn('flex', msg.role === 'user' ? 'justify-end' : 'justify-start')}>
            {msg.role === 'user' ? (
              <div className="bg-brand text-white rounded-2xl rounded-tr-sm px-4 py-2.5 max-w-[75%] text-sm shadow-lg shadow-brand-glow leading-relaxed">
                {msg.content}
              </div>
            ) : (
              <div className="flex flex-col gap-2 max-w-[80%]">
                <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-txt-secondary leading-relaxed shadow-sm">
                  {msg.content}
                </div>
                {msg.citations && msg.citations.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pl-1">
                    {msg.citations.map((c, i) => (
                      <button
                        key={i}
                        onClick={() => onCitationClick?.(c.chunkId, c.documentId)}
                        className="inline-flex items-center gap-1 bg-brand/10 text-brand text-sm font-medium px-2 py-1 rounded-full border border-brand/20 hover:bg-brand/20 transition-colors"
                      >
                        <span className="w-3.5 h-3.5 rounded-full bg-brand/20 flex items-center justify-center text-[9px]">{i + 1}</span>
                        Citation
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-card border border-border rounded-2xl rounded-tl-sm px-4 py-3 max-w-[80%] text-sm text-txt-muted shadow-sm">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-txt-muted animate-bounce [animation-delay:-0.3s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-txt-muted animate-bounce [animation-delay:-0.15s]" />
                  <span className="w-1.5 h-1.5 rounded-full bg-txt-muted animate-bounce" />
                </div>
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
      <div className="border-t border-border p-4 bg-bg">
        <div className="flex gap-2 items-end max-w-3xl mx-auto">
          <Textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your knowledge base..."
            className="flex-1 min-h-[44px] max-h-[120px] resize-none text-sm bg-card"
            rows={1}
          />
          <Button size="icon" onClick={handleSend} disabled={!input.trim() || loading} className="h-9 w-9 shrink-0 rounded-xl">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
