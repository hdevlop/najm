import { useState, useEffect, useCallback } from 'react';
import { useApiClient } from '@/lib/api';
import type { ChatMessage } from '@/features/chat/types';

const CHAT_STORAGE_KEY = 'najm-rag-studio:knowledge-chat';

interface KnowledgeSearchResponse {
  query: string;
  response?: string;
  citations?: Array<{
    chunkId: string;
    documentId?: string;
    text: string;
    score?: number;
    similarity?: number;
    ordinal: number;
    document?: { id: string; sourceType: string; };
  }>;
}

function loadStoredChatMessages(): ChatMessage[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.sessionStorage.getItem(CHAT_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function normalizeKnowledgeSearchResponse(result: KnowledgeSearchResponse): Pick<ChatMessage, 'content' | 'citations'> {
  const citations = (result.citations ?? []).map((citation) => ({
    chunkId: citation.chunkId,
    documentId: citation.documentId ?? citation.document?.id ?? '',
    text: citation.text,
    score: citation.score ?? citation.similarity ?? 0,
    ordinal: citation.ordinal,
    sourceType: citation.document?.sourceType ?? 'text',
  }));
  return {
    content: result.response ?? (
      citations.length > 0
        ? `Found ${citations.length} matching chunk${citations.length === 1 ? '' : 's'} for "${result.query}".`
        : `No matching knowledge chunks found for "${result.query}". Upload or reindex documents first, then try again.`
    ),
    citations,
  };
}

export function useKnowledgeChat() {
  const apiClient = useApiClient();
  const [messages, setMessages] = useState<ChatMessage[]>(loadStoredChatMessages);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    window.sessionStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(messages));
  }, [messages]);

  const handleSend = useCallback(async (content: string) => {
    const userMsg: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content,
      citations: [],
      timestamp: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);
    try {
      const res = await apiClient.post<KnowledgeSearchResponse>('/knowledge/search', { query: content });
      const normalized = normalizeKnowledgeSearchResponse(res);
      const aiMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: normalized.content,
        citations: normalized.citations,
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const errMsg: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: 'Sorry, an error occurred while processing your request.',
        citations: [],
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  }, [apiClient]);

  return { messages, loading, handleSend };
}
