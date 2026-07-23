import { apiClient } from './client';
import type { ApiUser } from './types';

export const usersService = {
  listAll(): Promise<ApiUser[]> {
    return apiClient.get<ApiUser[]>('/tools/users');
  },
};
