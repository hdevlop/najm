'use client';

import { useCallback, useMemo, useState } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport, type UIMessage } from 'ai';
import { useAuth } from 'najm-auth/client/react';
import { useAiSettings } from './useAiSettings';
import { useToolStatus } from './useToolStatus';
import type { ChatbotStatus, ChatbotView } from '../types';

export interface UseChatPanelOptions {
  apiPath: string;
  settingsApiPath: string;
  mcpApiPath: string;
  sessionKey?: string;
}

export interface UseChatPanelReturn {
  view: ChatbotView;
  input: string;
  messages: UIMessage[];
  isLoading: boolean;
  chatError: string | null;
  status: ChatbotStatus;
  settingsRecord: ReturnType<typeof useAiSettings>['settings'];
  settingsApi: ReturnType<typeof useAiSettings>;
  setInput: (value: string) => void;
  setView: (view: ChatbotView) => void;
  handleSubmit: (event?: { preventDefault?: () => void }) => void;
  handleSuggestion: (text: string) => void;
  clearMessages: () => void;
  stop: () => void;
}

export function useChatPanel(options: UseChatPanelOptions): UseChatPanelReturn {
  const [view, setView] = useState<ChatbotView>('chat');
  const [input, setInput] = useState('');
  const settingsApi = useAiSettings({ settingsApiPath: options.settingsApiPath });
  const status = useToolStatus(settingsApi.settings, options.mcpApiPath);
  const { accessToken } = useAuth();

  const headers = useMemo(() => (
    accessToken ? { Authorization: `Bearer ${accessToken}` } : undefined
  ), [accessToken]);

  const transport = useMemo(() => new DefaultChatTransport({
    api: options.apiPath,
    headers,
    body: options.sessionKey ? { sessionKey: options.sessionKey } : undefined,
  }), [headers, options.apiPath, options.sessionKey]);

  const chat = useChat({
    transport,
    onError: () => undefined,
  });

  const isLoading = chat.status === 'submitted' || chat.status === 'streaming';
  const chatError = chat.error?.message ?? null;

  const submitText = useCallback((text: string) => {
    const value = text.trim();
    if (!value || isLoading) return;
    setInput('');
    void chat.sendMessage({ text: value });
  }, [chat, isLoading]);

  const handleSubmit = useCallback((event?: { preventDefault?: () => void }) => {
    event?.preventDefault?.();
    submitText(input);
  }, [input, submitText]);

  const handleSuggestion = useCallback((text: string) => {
    submitText(text);
  }, [submitText]);

  const clearMessages = useCallback(() => {
    chat.setMessages([]);
  }, [chat]);

  return {
    view,
    input,
    messages: chat.messages,
    isLoading,
    chatError,
    status,
    settingsRecord: settingsApi.settings,
    settingsApi,
    setInput,
    setView,
    handleSubmit,
    handleSuggestion,
    clearMessages,
    stop: chat.stop,
  };
}
