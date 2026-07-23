import { apiClient } from './client';
import type { ApiHealthSummary } from './types';

export const healthService = {
  getSummary(): Promise<ApiHealthSummary> {
    return apiClient.get<ApiHealthSummary>('/health/summary');
  },
};
