import { apiClient } from './client';
import type { ApiCartSummary } from './types';

export const cartService = {
  getMine(): Promise<ApiCartSummary> {
    return apiClient.get<ApiCartSummary>('/cart');
  },
};
