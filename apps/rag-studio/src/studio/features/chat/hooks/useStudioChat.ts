import { useState, useCallback, useEffect, useRef } from 'react';
import { useApiClient } from '@/lib/api';
import type {
  StudioChatDebugRequest,
  StudioChatDebugResponse,
  StudioChatDebugError,
} from '@/features/chat/types';

export interface ChatDebugMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  trace?: StudioChatDebugResponse;
  error?: StudioChatDebugError;
  isLoading?: boolean;
}

const CHAT_DEBUG_STORAGE_KEY = 'najm-rag-studio:chat-debug';

interface StoredStudioChat {
  messages: ChatDebugMessage[];
  sessionKey?: string;
}

function createChatId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }

  const randomPart =
    typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function'
      ? Array.from(crypto.getRandomValues(new Uint32Array(2)), n => n.toString(36)).join('')
      : Math.random().toString(36).slice(2);

  return `chat-${Date.now().toString(36)}-${randomPart}`;
}

function stripReasoningBlocks(content: string): string {
  return content
    .replace(/<think>[\s\S]*?(?:<\/think>|$)/gi, '')
    .replace(/<thinking>[\s\S]*?(?:<\/thinking>|$)/gi, '')
    .trimStart();
}

function loadStoredStudioChat(): StoredStudioChat {
  if (typeof window === 'undefined') return { messages: [] };
  try {
    const raw = window.sessionStorage.getItem(CHAT_DEBUG_STORAGE_KEY);
    if (!raw) return { messages: [] };
    const parsed = JSON.parse(raw) as Partial<StoredStudioChat>;
    return {
      messages: Array.isArray(parsed.messages)
        ? parsed.messages
            .filter((m) => !m.isLoading)
            .map((m) => m.role === 'assistant' ? { ...m, content: stripReasoningBlocks(m.content ?? '') } : m)
        : [],
      sessionKey: typeof parsed.sessionKey === 'string' ? parsed.sessionKey : undefined,
    };
  } catch {
    return { messages: [] };
  }
}

export function useStudioChat() {
  const initialChat = useRef<StoredStudioChat | null>(null);
  if (initialChat.current === null) initialChat.current = loadStoredStudioChat();

  const [messages, setMessages] = useState<ChatDebugMessage[]>(initialChat.current.messages);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sessionKey, setSessionKey] = useState<string | undefined>(initialChat.current.sessionKey);
  const abortRef = useRef<AbortController | null>(null);
  const api = useApiClient();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.sessionStorage.setItem(
      CHAT_DEBUG_STORAGE_KEY,
      JSON.stringify({
        messages: messages.filter((m) => !m.isLoading),
        sessionKey,
      }),
    );
  }, [messages, sessionKey]);

  const send = useCallback(async (text: string) => {
    const userMsg: ChatDebugMessage = {
      id: createChatId(),
      role: 'user',
      content: text,
    };
    const assistantMsg: ChatDebugMessage = {
      id: createChatId(),
      role: 'assistant',
      content: '',
      isLoading: true,
    };

    setMessages(prev => [...prev, userMsg, assistantMsg]);
    setIsLoading(true);
    setError(null);

    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const body: StudioChatDebugRequest = {
        message: text,
        messages: [{ id: userMsg.id, role: 'user', content: text }],
        sessionKey,
        includeKnowledge: true,
        includeRouting: true,
        includeToolCalls: true,
      };

      const result = await api.post<StudioChatDebugResponse | StudioChatDebugError>(
        '/chat-debug',
        body,
        controller.signal,
      );

      if (controller.signal.aborted) return;

      if ('error' in result) {
        const err = result as StudioChatDebugError;
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMsg.id
              ? { ...m, content: '', error: err, isLoading: false }
              : m,
          ),
        );
        setError(err.error);
      } else {
        const resp = result as StudioChatDebugResponse;
        const answer = stripReasoningBlocks(resp.answer);
        if (resp.sessionKey) setSessionKey(resp.sessionKey);
        setMessages(prev =>
          prev.map(m =>
            m.id === assistantMsg.id
              ? { ...m, content: answer, trace: { ...resp, answer }, isLoading: false }
              : m,
          ),
        );
      }
    } catch (err) {
      if (controller.signal.aborted) return;
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setMessages(prev =>
        prev.map(m =>
          m.id === assistantMsg.id
            ? { ...m, content: '', error: { error: msg, code: 'PROVIDER_ERROR' }, isLoading: false }
            : m,
        ),
      );
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  }, [sessionKey, api]);

  const clear = useCallback(() => {
    setMessages([]);
    setSessionKey(undefined);
    setError(null);
    abortRef.current?.abort();
    if (typeof window !== 'undefined') {
      window.sessionStorage.removeItem(CHAT_DEBUG_STORAGE_KEY);
    }
  }, []);

  const abort = useCallback(() => {
    abortRef.current?.abort();
  }, []);

  return { messages, isLoading, error, sessionKey, send, clear, abort };
}
