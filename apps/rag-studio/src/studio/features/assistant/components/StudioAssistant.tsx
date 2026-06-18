import React, { useState, useCallback, useRef, useEffect } from 'react';
import { MessageSquare, X, Send, Loader2, Wrench } from 'lucide-react';
import { Button } from 'najm-kit';
import { ScrollArea } from 'najm-kit';
import { useRagStudio } from '@/lib/context';
import { readStudioAssistantStream } from './readStudioAssistantStream';
import {
  type StudioAssistantMessage,
  type StudioAssistantToolCall,
  type StudioAssistantEvent,
  type RefreshBucket,
} from '../types';
import {
  normalizeStudioView,
  TOOL_REFRESH_BUCKETS,
} from '../constants';

interface StudioAssistantProps {
  activeWorkspace: string;
  viewContext?: Record<string, unknown>;
  onToolResult?: (toolName: string) => void;
}

const TOOL_DISPLAY_NAMES: Record<string, string> = {
  rag_studio_list_semantics: 'List Semantics',
  rag_studio_semantic_groups: 'Semantic Groups',
  rag_studio_export_semantics: 'Export Semantics',
  rag_studio_get_semantic: 'Get Semantic',
  rag_studio_create_semantic: 'Create Semantic',
  rag_studio_import_semantics: 'Import Semantics',
  rag_studio_reindex_semantics: 'Reindex Semantics',
  rag_studio_update_semantic: 'Update Semantic',
  rag_studio_delete_semantics_batch: 'Delete Semantics Batch',
  rag_studio_delete_semantic: 'Delete Semantic',
  rag_studio_preview_routing: 'Preview Routing',
  rag_studio_list_routing_tests: 'List Tests',
  rag_studio_export_routing_tests: 'Export Tests',
  rag_studio_get_routing_test: 'Get Test',
  rag_studio_create_routing_test: 'Create Test',
  rag_studio_run_all_routing_tests: 'Run All Tests',
  rag_studio_import_routing_tests: 'Import Tests',
  rag_studio_update_routing_test: 'Update Test',
  rag_studio_run_routing_test: 'Run Test',
  rag_studio_delete_routing_tests_batch: 'Delete Tests Batch',
  rag_studio_delete_all_routing_tests: 'Delete All Tests',
  rag_studio_delete_routing_test: 'Delete Test',
  rag_studio_tool_list: 'List Tools',
  rag_studio_reindex_tools: 'Reindex Tools',
  rag_studio_search_knowledge: 'Search Knowledge',
  rag_studio_status: 'Status',
};

function formatToolName(name: string): string {
  return TOOL_DISPLAY_NAMES[name] ?? name.replace('rag_studio_', '').replace(/_/g, ' ');
}

export function StudioAssistant({ activeWorkspace, viewContext, onToolResult }: StudioAssistantProps) {
  const { apiBase, getAuthHeaders } = useRagStudio();
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<StudioAssistantMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState<string | undefined>();
  const [error, setError] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  const view = normalizeStudioView(activeWorkspace);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleToolResult = useCallback((toolName: string) => {
    const buckets = TOOL_REFRESH_BUCKETS[toolName] ?? [];
    if (buckets.length > 0) {
      onToolResult?.(toolName);
    }
  }, [onToolResult]);

  const sendMessage = useCallback(async () => {
    const trimmed = input.trim();
    if (!trimmed || loading) return;

    const userMessage: StudioAssistantMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: trimmed,
    };

    const assistantMessage: StudioAssistantMessage = {
      id: `assistant-${Date.now()}`,
      role: 'assistant',
      content: '',
      toolCalls: [],
    };

    setMessages((prev) => [...prev, userMessage, assistantMessage]);
    setInput('');
    setLoading(true);
    setError(null);

    const abortController = new AbortController();
    abortRef.current = abortController;

    try {
      const res = await fetch(`${apiBase}/assistant/chat`, {
        method: 'POST',
        credentials: 'same-origin',
        headers: {
          ...getAuthHeaders(),
          'Content-Type': 'application/json',
          Accept: 'text/event-stream',
        },
        body: JSON.stringify({
          workspace: activeWorkspace,
          message: trimmed,
          sessionId,
          context: viewContext,
        }),
        signal: abortController.signal,
      });

      if (!res.ok) {
        const bodyText = await res.text().catch(() => '');
        let msg = res.statusText || `HTTP ${res.status}`;
        try {
          const parsed = JSON.parse(bodyText);
          msg = parsed.message || parsed.error || msg;
        } catch {
          if (bodyText.trim()) msg = bodyText.trim().slice(0, 200);
        }
        setMessages((prev) => {
          const updated = [...prev];
          const last = updated[updated.length - 1];
          updated[updated.length - 1] = { ...last, content: `Error: ${msg}` };
          return updated;
        });
        setLoading(false);
        return;
      }

      await readStudioAssistantStream(res, (event: StudioAssistantEvent) => {
        if (event.type === 'text') {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            updated[updated.length - 1] = { ...last, content: last.content + event.delta };
            return updated;
          });
        } else if (event.type === 'tool_call') {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            const toolCall: StudioAssistantToolCall = {
              id: event.id,
              name: event.name,
              args: event.args,
              status: 'running',
              requiresConfirmation: event.requiresConfirmation,
            };
            updated[updated.length - 1] = {
              ...last,
              toolCalls: [...(last.toolCalls ?? []), toolCall],
            };
            return updated;
          });
        } else if (event.type === 'tool_result') {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            const toolCalls = (last.toolCalls ?? []).map((tc) =>
              tc.id === event.id
                ? { ...tc, status: event.ok ? 'success' as const : 'error' as const, result: event.result, error: event.error }
                : tc,
            );
            updated[updated.length - 1] = { ...last, toolCalls };
            return updated;
          });
          if (event.ok) {
            handleToolResult(event.name);
          }
        } else if (event.type === 'done') {
          setSessionId(event.sessionId);
        } else if (event.type === 'error') {
          setMessages((prev) => {
            const updated = [...prev];
            const last = updated[updated.length - 1];
            updated[updated.length - 1] = { ...last, content: last.content || `Error: ${event.message}` };
            return updated;
          });
        }
      });
    } catch (err) {
      if (!abortController.signal.aborted) {
        setError(err instanceof Error ? err.message : 'Failed to send message.');
      }
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  }, [input, loading, apiBase, getAuthHeaders, activeWorkspace, sessionId, viewContext, handleToolResult]);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }, [sendMessage]);

  if (!view) return null;

  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-5 right-5 z-50 flex h-11 w-11 items-center justify-center rounded-full bg-brand text-white shadow-lg hover:bg-brand/90 transition-colors"
          title="Studio Assistant"
        >
          <MessageSquare className="h-5 w-5" />
        </button>
      )}

      {open && (
        <div className="fixed bottom-5 right-5 z-50 flex flex-col w-[400px] h-[520px] rounded-xl border border-border bg-card shadow-2xl overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-sidebar">
            <div className="flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-brand" />
              <span className="text-sm font-medium text-txt-primary">Studio Assistant</span>
              <span className="text-xs text-txt-muted bg-bg px-1.5 py-0.5 rounded">
                {view}
              </span>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-txt-muted hover:text-txt-primary transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-3 space-y-3">
            {messages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center gap-2 px-4">
                <MessageSquare className="h-8 w-8 text-txt-muted" />
                <p className="text-sm text-txt-muted">
                  Ask about the {view} view. I can help you create, search, and manage your data.
                </p>
              </div>
            )}
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex flex-col gap-1.5 ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                {msg.content && (
                  <div
                    className={`max-w-[85%] rounded-lg px-3 py-2 text-sm whitespace-pre-wrap break-words ${
                      msg.role === 'user'
                        ? 'bg-brand/20 text-txt-primary'
                        : 'bg-bg text-txt-primary border border-border'
                    }`}
                  >
                    {msg.content}
                  </div>
                )}
                {msg.toolCalls && msg.toolCalls.length > 0 && (
                  <div className="flex flex-col gap-1 w-full">
                    {msg.toolCalls.map((tc) => (
                      <div
                        key={tc.id}
                        className="flex items-center gap-2 rounded-md border border-border bg-bg px-2 py-1 text-xs"
                      >
                        <Wrench className="h-3 w-3 text-txt-muted shrink-0" />
                        <span className="text-txt-secondary truncate">{formatToolName(tc.name)}</span>
                        {tc.requiresConfirmation && (
                          <span className="text-[10px] font-medium px-1 py-0.5 rounded bg-status-yellow/20 text-status-yellow">
                            write
                          </span>
                        )}
                        <span
                          className={`ml-auto text-[10px] font-medium px-1.5 py-0.5 rounded ${
                            tc.status === 'success'
                              ? 'bg-status-green/20 text-status-green'
                              : tc.status === 'error'
                                ? 'bg-status-red/20 text-status-red'
                                : tc.status === 'pending'
                                  ? 'bg-status-yellow/20 text-status-yellow'
                                  : 'bg-brand/20 text-brand'
                          }`}
                        >
                          {tc.status}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex items-center gap-2 pl-2">
                <Loader2 className="h-3.5 w-3.5 animate-spin text-brand" />
                <span className="text-xs text-txt-muted">Thinking...</span>
              </div>
            )}
            {error && (
              <div className="rounded-md border border-status-red/30 bg-status-red/10 px-3 py-2 text-xs text-status-red">
                {error}
              </div>
            )}
          </div>

          <div className="border-t border-border p-3">
            <div className="flex gap-2">
              <textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={`Ask about ${view}...`}
                rows={1}
                className="flex-1 resize-none rounded-md border border-border bg-bg px-3 py-2 text-sm text-txt-primary placeholder:text-txt-muted focus:outline-none focus:ring-1 focus:ring-brand"
                disabled={loading}
              />
              <Button
                size="sm"
                onClick={sendMessage}
                disabled={loading || !input.trim()}
                className="shrink-0"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}