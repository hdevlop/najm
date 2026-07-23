import { apiClient } from './client';
import type { ApiOrder } from './types';

export const ordersService = {
  listMine(): Promise<ApiOrder[]> {
    return apiClient.get<ApiOrder[]>('/orders/my');
  },
};
