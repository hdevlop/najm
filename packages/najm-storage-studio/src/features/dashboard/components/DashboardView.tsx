import React, { useState } from 'react';
import { Cpu, FileText, FolderKanban, Image, LayoutDashboard, Loader2 } from 'lucide-react';
import { useUsage } from '../hooks/useUsage';
import { useActivity } from '../hooks/useActivity';
import { useBuckets } from '../hooks/useBuckets';
import { StateCard } from '../components/StateCard';
import { StorageOverviewCard } from '../components/StorageOverviewCard';
import { RecentActivityTable } from '../components/RecentActivityTable';
import { NamespaceBreakdown } from '../components/NamespaceBreakdown';
import { NErrorState, NPageHeader } from 'najm-ui';
import type { DashboardViewProps, UsageCategory } from '../types';
import { STORAGE_QUOTA_BYTES } from '../constants';

const CATEGORY_QUOTA_BYTES = 1024 ** 4;
const IMAGE_KEYS = ['image', 'images'];
const PROJECT_KEYS = ['project', 'projects'];
const DOCUMENT_KEYS = ['document', 'documents', 'doc', 'docs', 'pdf', 'text', 'spreadsheet', 'presentation'];

function normalizeCategory(category: string): string {
  return category.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function sumCategories(categories: UsageCategory[], keys: string[]) {
  const normalizedKeys = new Set(keys.map(normalizeCategory));

  return categories.reduce(
    (total, category) => {
      if (!normalizedKeys.has(normalizeCategory(category.category))) return total;
      return {
        count: total.count + category.count,
        bytes: total.bytes + category.bytes,
      };
    },
    { count: 0, bytes: 0 },
  );
}

function sumOtherCategories(categories: UsageCategory[]) {
  const groupedKeys = new Set([...IMAGE_KEYS, ...PROJECT_KEYS, ...DOCUMENT_KEYS].map(normalizeCategory));

  return categories.reduce(
    (total, category) => {
      if (groupedKeys.has(normalizeCategory(category.category))) return total;
      return {
        count: total.count + category.count,
        bytes: total.bytes + category.bytes,
      };
    },
    { count: 0, bytes: 0 },
  );
}

export function DashboardView() {
  const { data: usage, error: usageError, isLoading: usageLoading } = useUsage();
  const { data: activity, error: activityError, isLoading: activityLoading } = useActivity({ limit: 20 });
  const { data: namespaces, error: nsError, isLoading: nsLoading } = useBuckets();

  const categories = usage?.categories ?? [];
  const imageStats = sumCategories(categories, IMAGE_KEYS);
  const projectStats = sumCategories(categories, PROJECT_KEYS);
  const documentStats = sumCategories(categories, DOCUMENT_KEYS);
  const otherStats = sumOtherCategories(categories);

  const hasError = usageError || activityError || nsError;

  return (
    <NPageHeader
      icon={LayoutDashboard}
      title="Dashboard"
      subtitle="Usage overview, storage breakdown, and recent activity"
      search={{ placeholder: "Search files, buckets..." }}
      actions={
        <div className="flex items-center gap-2 sm:ml-auto">
          {(usageLoading || activityLoading || nsLoading) && (
            <Loader2 className="h-4 w-4 animate-spin text-txt-muted" />
          )}
        </div>
      }
      contentClassName="flex flex-1 flex-col min-h-0 overflow-hidden p-4 sm:p-5"
    >

      {hasError && (
        <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
          {usageError?.message || activityError?.message || nsError?.message || 'Failed to load dashboard data'}
        </div>
      )}

      <div className="grid min-h-0 flex-1 grid-cols-1 items-stretch gap-4 overflow-hidden lg:grid-cols-[minmax(0,1fr)_380px]">
        <div className="flex min-h-0 flex-col gap-4 overflow-hidden">
          {!usageError && (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <StateCard
                icon={Image}
                iconColor="text-[#ff5c7c]"
                iconBgColor="#3a101d"
                accentColor="#ff4f79"
                title="Images"
                count={imageStats.count}
                used={imageStats.bytes}
                total={CATEGORY_QUOTA_BYTES}
              />
              <StateCard
                icon={FolderKanban}
                iconColor="text-[#5a9bff]"
                iconBgColor="#112344"
                accentColor="#3f86ff"
                title="Projects"
                count={projectStats.count}
                used={projectStats.bytes}
                total={CATEGORY_QUOTA_BYTES}
              />
              <StateCard
                icon={FileText}
                iconColor="text-[#20d7a3]"
                iconBgColor="#083328"
                accentColor="#19c99a"
                title="Documents"
                count={documentStats.count}
                used={documentStats.bytes}
                total={CATEGORY_QUOTA_BYTES}
              />
              <StateCard
                icon={Cpu}
                iconColor="text-[#f5bd16]"
                iconBgColor="#352605"
                accentColor="#d4a20b"
                title="Others"
                count={otherStats.count}
                used={otherStats.bytes}
                total={CATEGORY_QUOTA_BYTES}
              />
            </div>
          )}

          <section className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden">
            <div className="text-sm font-bold text-txt">Recent Activity</div>
            <RecentActivityTable
              rows={activity ?? []}
              loading={activityLoading}
              error={activityError?.message ?? null}
            />
          </section>

          <section className="flex min-h-0 flex-[0.6] flex-col gap-3 overflow-hidden">
            <div className="text-sm font-bold text-txt">Namespaces</div>
            {nsError ? (
              <NErrorState title="Error" message={nsError.message} />
            ) : (
              <NamespaceBreakdown namespaces={namespaces ?? []} totalQuota={STORAGE_QUOTA_BYTES} />
            )}
          </section>
        </div>

        <div className="flex min-h-0 flex-col overflow-hidden">
          {usageError ? (
            <NErrorState title="Error" message={usageError.message} />
          ) : (
            <StorageOverviewCard
              totalBytes={usage?.totalBytes ?? 0}
              totalCount={usage?.totalCount ?? 0}
              categories={usage?.categories ?? []}
            />
          )}
        </div>
      </div>
    </NPageHeader>
  );
}
