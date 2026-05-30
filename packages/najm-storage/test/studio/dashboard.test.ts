import { describe, test, expect } from 'bun:test';
import { NEmptyState as EmptyState, NErrorState as ErrorState, NLoadingState as LoadingState } from 'najm-ui';
import { DashboardView } from '../../src/studio/features/dashboard';
import { NamespaceBreakdown } from '../../src/studio/features/dashboard/components/NamespaceBreakdown';
import { RecentActivityTable } from '../../src/studio/features/dashboard/components/RecentActivityTable';
import { StorageOverviewCard } from '../../src/studio/features/dashboard/components/StorageOverviewCard';
import { useActivity } from '../../src/studio/features/dashboard/hooks/useActivity';
import { useUsage } from '../../src/studio/features/dashboard/hooks/useUsage';

describe('Dashboard components', () => {
  test('all dashboard components are exported as functions', () => {
    expect(typeof DashboardView).toBe('function');
    expect(typeof StorageOverviewCard).toBe('function');
    expect(typeof RecentActivityTable).toBe('function');
    expect(typeof NamespaceBreakdown).toBe('function');
    expect(typeof EmptyState).toBe('function');
    expect(typeof LoadingState).toBe('function');
    expect(typeof ErrorState).toBe('function');
    expect(typeof useUsage).toBe('function');
    expect(typeof useActivity).toBe('function');
  });
});
