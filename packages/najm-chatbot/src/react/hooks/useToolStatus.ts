'use client';

import { useEffect, useState } from 'react';
import type { ChatbotStatus } from '../types';
import type { AiSettingsRecord } from './useAiSettings';
import { useAuthenticatedFetch } from './useAuthenticatedFetch';

function countTools(payload: unknown): number {
  const result = (payload as any)?.result;
  const tools = result?.tools ?? (payload as any)?.tools;
  return Array.isArray(tools) ? tools.length : 0;
}

export function useToolStatus(settings: AiSettingsRecord | null, mcpApiPath: string): ChatbotStatus {
  const authFetch = useAuthenticatedFetch();
  const [status, setStatus] = useState<ChatbotStatus>('disabled');

  useEffect(() => {
    let cancelled = false;

    async function load() {
      if (!settings || settings.isEnabled === false) {
        setStatus('disabled');
        return;
      }

      try {
        const response = await authFetch(mcpApiPath, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Accept: 'application/json, text/event-stream',
          },
          body: JSON.stringify({
            jsonrpc: '2.0',
            id: 'najm-chatbot-react-tools',
            method: 'tools/list',
            params: {},
          }),
        });

        const text = await response.text();
        let payload: unknown = null;
        try {
          payload = JSON.parse(text);
        } catch {
          const dataLine = text.split('\n').find((line) => line.startsWith('data:'));
          if (dataLine) payload = JSON.parse(dataLine.slice(5).trim());
        }

        if (!cancelled) setStatus(countTools(payload) > 0 ? 'ready' : 'empty-tools');
      } catch {
        if (!cancelled) setStatus('empty-tools');
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, [authFetch, mcpApiPath, settings]);

  return status;
}
