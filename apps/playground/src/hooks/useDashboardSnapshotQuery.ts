'use client';

import { useQuery } from '@tanstack/react-query';
import { getDashboardSnapshot } from '@/services/api/dashboard';

export function useDashboardSnapshotQuery(role?: string | null, permissions?: string[]) {
  return useQuery({
    queryKey: ['dashboard-snapshot', role ?? 'member', ...(permissions ?? [])],
    queryFn: () => getDashboardSnapshot(role, permissions),
  });
}
