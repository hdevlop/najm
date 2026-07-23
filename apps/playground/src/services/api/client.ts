import { auth } from '@/lib/auth';
import type { RequestOptions, ServerResponse } from 'najm-auth/client';

const api = auth.api;

function hasEnvelope<T>(value: unknown): value is ServerResponse<T> {
  return !!value && typeof value === 'object' && 'data' in value;
}

function unwrapData<T>(value: T | ServerResponse<T>): T {
  return hasEnvelope<T>(value) ? value.data : value;
}

export const apiClient = {
  async get<T>(path: string, opts?: RequestOptions): Promise<T> {
    const response = await api.get<T | ServerResponse<T>>(path, opts);
    return unwrapData(response);
  },
  async post<T>(path: string, opts?: RequestOptions): Promise<T> {
    const response = await api.post<T | ServerResponse<T>>(path, opts);
    return unwrapData(response);
  },
  async put<T>(path: string, opts?: RequestOptions): Promise<T> {
    const response = await api.put<T | ServerResponse<T>>(path, opts);
    return unwrapData(response);
  },
  async patch<T>(path: string, opts?: RequestOptions): Promise<T> {
    const response = await api.patch<T | ServerResponse<T>>(path, opts);
    return unwrapData(response);
  },
  async delete<T>(path: string, opts?: RequestOptions): Promise<T> {
    const response = await api.delete<T | ServerResponse<T>>(path, opts);
    return unwrapData(response);
  },
};
