import { apiClient } from './client';
import type { ApiProduct } from './types';

export const productsService = {
  listAll(): Promise<ApiProduct[]> {
    return apiClient.get<ApiProduct[]>('/products');
  },
  listMine(): Promise<ApiProduct[]> {
    return apiClient.get<ApiProduct[]>('/products/my');
  },
};
