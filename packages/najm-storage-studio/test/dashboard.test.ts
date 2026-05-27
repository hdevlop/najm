import { describe, test, expect } from 'bun:test';
import { DashboardPanel } from '../src/panels/DashboardPanel';
import { StateCard } from '../src/components/dashboard/StateCard';
import { StorageOverviewCard } from '../src/components/dashboard/StorageOverviewCard';
import { RecentActivityTable } from '../src/components/dashboard/RecentActivityTable';
import { NamespaceBreakdown } from '../src/components/dashboard/NamespaceBreakdown';
import { EmptyState } from '../src/components/common/EmptyState';
import { LoadingState } from '../src/components/common/LoadingState';
import { ErrorState } from '../src/components/common/ErrorState';
import { useUsage } from '../src/hooks/useUsage';
import { useActivity } from '../src/hooks/useActivity';

describe('Dashboard components', () => {
  test('all dashboard components are exported as functions', () => {
    expect(typeof DashboardPanel).toBe('function');
    expect(typeof StateCard).toBe('function');
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
