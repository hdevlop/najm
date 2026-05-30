import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { useApiClient } from '@/lib/api';
import type { LiveRoutingSettings } from '@/features/logs/types';

const SETTINGS_KEY = ['rag-studio', 'settings'] as const;

export function useStudioSettings() {
  const apiClient = useApiClient();
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: SETTINGS_KEY,
    queryFn: () => apiClient.get<LiveRoutingSettings>('/settings'),
  });

  const setSettings = useCallback((settings: LiveRoutingSettings) => {
    queryClient.setQueryData(SETTINGS_KEY, settings);
  }, [queryClient]);

  return {
    settings: query.data,
    enableKnowledge: query.data?.enableKnowledge ?? true,
    setSettings,
  };
}
