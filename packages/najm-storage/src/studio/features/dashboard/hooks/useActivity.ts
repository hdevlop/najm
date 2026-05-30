import useSWR from 'swr';
import { useApiClient } from '../../../lib/api';
import type { AuditEntry } from '../types';

export function useActivity(opts?: { namespace?: string; limit?: number }) {
  const api = useApiClient();
  const qs = new URLSearchParams();
  if (opts?.namespace) qs.set('namespace', opts.namespace);
  if (opts?.limit) qs.set('limit', String(opts.limit));
  const query = qs.toString();
  const key = query ? `activity?${query}` : 'activity';

  return useSWR<AuditEntry[]>(key, () => api.get<AuditEntry[]>(`/activity${query ? `?${query}` : ''}`), {
    refreshInterval: 30000,
  });
}
