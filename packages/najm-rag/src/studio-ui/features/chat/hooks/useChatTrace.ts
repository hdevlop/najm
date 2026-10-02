import { useState, useCallback } from 'react';
import type { ChatDebugMessage } from './useStudioChat';

export function useChatTrace() {
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(null);
  const [expandedToolCalls, setExpandedToolCalls] = useState<Set<string>>(new Set());
  const [expandedChunks, setExpandedChunks] = useState<Set<string>>(new Set());

  const toggleToolCall = useCallback((toolName: string) => {
    setExpandedToolCalls(prev => {
      const next = new Set(prev);
      if (next.has(toolName)) next.delete(toolName);
      else next.add(toolName);
      return next;
    });
  }, []);

  const toggleChunk = useCallback((chunkId: string) => {
    setExpandedChunks(prev => {
      const next = new Set(prev);
      if (next.has(chunkId)) next.delete(chunkId);
      else next.add(chunkId);
      return next;
    });
  }, []);

  const selectMessage = useCallback((message: ChatDebugMessage | null) => {
    setSelectedMessageId(message?.id ?? null);
    setExpandedToolCalls(new Set());
    setExpandedChunks(new Set());
  }, []);

  return {
    selectedMessageId,
    setSelectedMessageId,
    expandedToolCalls,
    expandedChunks,
    toggleToolCall,
    toggleChunk,
    selectMessage,
  };
}
