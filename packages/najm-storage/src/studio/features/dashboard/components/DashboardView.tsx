import React from 'react';
import { Code2, Cpu, Database, FileText, Film, FolderKanban, Headphones, Image, LayoutDashboard, Loader2, Package, Presentation, Settings, Table } from 'lucide-react';
import { useUsage } from '../hooks/useUsage';
import { useActivity } from '../hooks/useActivity';
import { useBuckets } from '../hooks/useBuckets';
import { NStatCard } from 'najm-kit';
import { StorageOverviewCard } from '../components/StorageOverviewCard';
import { RecentActivityTable } from '../components/RecentActivityTable';
import { NamespaceBreakdown } from '../components/NamespaceBreakdown';
import { NErrorState, NPageHeader } from 'najm-kit';
import type { UsageCategory } from '../types';
import { STORAGE_QUOTA_BYTES } from '../constants';

const CATEGORY_QUOTA_BYTES = 1024 ** 4;
const IMAGE_KEYS = ['image', 'images', 'img', 'picture', 'pictures', 'photo', 'photos', 'avatar', 'avatars'];
const PROJECT_KEYS = ['project', 'projects', 'repo', 'repository'];
const DOCUMENT_KEYS = ['document', 'documents', 'doc', 'docs', 'pdf', 'text', 'word', 'letter', 'markdown', 'md'];
const SPREADSHEET_KEYS = ['spreadsheet', 'spreadsheets', 'sheet', 'sheets', 'excel', 'csv', 'xls', 'xlsx'];
const PRESENTATION_KEYS = ['presentation', 'presentations', 'ppt', 'slide', 'slides', 'deck', 'keynote'];
const VIDEO_KEYS = ['video', 'videos', 'movie', 'film', 'mp4', 'mov', 'avi'];
const AUDIO_KEYS = ['audio', 'music', 'sound', 'podcast', 'voice', 'mp3', 'wav', 'ogg'];
const CODE_KEYS = ['code', 'script', 'scripts', 'source', 'json', 'xml', 'yaml', 'yml', 'html', 'css', 'js', 'ts', 'py'];
const ARCHIVE_KEYS = ['archive', 'archives', 'zip', 'tar', 'gz', 'rar', '7z', 'backup', 'backups'];
const DATABASE_KEYS = ['database', 'db', 'sql', 'sqlite', 'data'];
const CONFIG_KEYS = ['config', 'configuration', 'settings', 'env', 'dotfile', 'dotfiles'];
const ALL_GROUP_KEYS = [
  ...IMAGE_KEYS,
  ...PROJECT_KEYS,
  ...DOCUMENT_KEYS,
  ...SPREADSHEET_KEYS,
  ...PRESENTATION_KEYS,
  ...VIDEO_KEYS,
  ...AUDIO_KEYS,
  ...CODE_KEYS,
  ...ARCHIVE_KEYS,
  ...DATABASE_KEYS,
  ...CONFIG_KEYS,
];

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
  const groupedKeys = new Set(ALL_GROUP_KEYS.map(normalizeCategory));

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
  const spreadsheetStats = sumCategories(categories, SPREADSHEET_KEYS);
  const presentationStats = sumCategories(categories, PRESENTATION_KEYS);
  const videoStats = sumCategories(categories, VIDEO_KEYS);
  const audioStats = sumCategories(categories, AUDIO_KEYS);
  const codeStats = sumCategories(categories, CODE_KEYS);
  const archiveStats = sumCategories(categories, ARCHIVE_KEYS);
  const databaseStats = sumCategories(categories, DATABASE_KEYS);
  const configStats = sumCategories(categories, CONFIG_KEYS);
  const otherStats = sumOtherCategories(categories);
  const statCards = [
    {
      icon: Image,
      iconColor: 'text-[#ff5c7c]',
      iconBgColor: '#3a101d',
      accentColor: '#ff4f79',
      label: 'Images',
      stats: imageStats,
    },
    {
      icon: Headphones,
      iconColor: 'text-[#f5bd16]',
      iconBgColor: '#352605',
      accentColor: '#d4a20b',
      label: 'Audio',
      stats: audioStats,
    },
    {
      icon: Code2,
      iconColor: 'text-[#a78bfa]',
      iconBgColor: '#24153c',
      accentColor: '#8b5cf6',
      label: 'Code',
      stats: codeStats,
    },
    {
      icon: Package,
      iconColor: 'text-[#a1a1aa]',
      iconBgColor: '#27272a',
      accentColor: '#71717a',
      label: 'Archives',
      stats: archiveStats,
    },
    {
      icon: FileText,
      iconColor: 'text-[#20d7a3]',
      iconBgColor: '#083328',
      accentColor: '#19c99a',
      label: 'Documents',
      stats: documentStats,
    },
    {
      icon: Table,
      iconColor: 'text-[#34d399]',
      iconBgColor: '#0d3026',
      accentColor: '#34d399',
      label: 'Sheets',
      stats: spreadsheetStats,
    },
    {
      icon: Presentation,
      iconColor: 'text-[#f472b6]',
      iconBgColor: '#3b1027',
      accentColor: '#f472b6',
      label: 'Slides',
      stats: presentationStats,
    },
    {
      icon: Film,
      iconColor: 'text-[#c084fc]',
      iconBgColor: '#2a1542',
      accentColor: '#a855f7',
      label: 'Videos',
      stats: videoStats,
    },
    {
      icon: FolderKanban,
      iconColor: 'text-[#5a9bff]',
      iconBgColor: '#112344',
      accentColor: '#3f86ff',
      label: 'Projects',
      stats: projectStats,
    },
    {
      icon: Database,
      iconColor: 'text-[#22d3ee]',
      iconBgColor: '#08313a',
      accentColor: '#06b6d4',
      label: 'Database',
      stats: databaseStats,
    },
    {
      icon: Settings,
      iconColor: 'text-[#94a3b8]',
      iconBgColor: '#1f2933',
      accentColor: '#94a3b8',
      label: 'Config',
      stats: configStats,
    },
    {
      icon: Cpu,
      iconColor: 'text-[#f59e0b]',
      iconBgColor: '#33220a',
      accentColor: '#f59e0b',
      label: 'Others',
      stats: otherStats,
    },
  ];

  const hasError = usageError || activityError || nsError;

  return (
    <div className="flex h-full flex-col">
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
      />

      <div className="ss-scrollbar overflow-auto p-4 sm:p-5">
        {hasError && (
          <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {usageError?.message || activityError?.message || nsError?.message || 'Failed to load dashboard data'}
          </div>
        )}

      <div className="grid min-h-[calc(100dvh-120px)] grid-cols-1 gap-4 xl:grid-cols-6">
        <div className="grid min-h-0 gap-4 xl:col-span-4 xl:grid-rows-[minmax(420px,1fr)_auto]">
          <RecentActivityTable
            rows={activity ?? []}
            loading={activityLoading}
            error={activityError?.message ?? null}
          />

          {nsError ? (
            <NErrorState title="Error" message={nsError.message} />
          ) : (
            <NamespaceBreakdown namespaces={namespaces ?? []} totalQuota={STORAGE_QUOTA_BYTES} />
          )}
        </div>

        <aside className="ss-scrollbar min-h-0 overflow-auto pr-1 xl:col-span-2">
          <div className="grid gap-4">
            {usageError ? (
              <NErrorState title="Error" message={usageError.message} />
            ) : (
              <StorageOverviewCard
                orientation="vertical"
                totalBytes={usage?.totalBytes ?? 0}
                totalCount={usage?.totalCount ?? 0}
                categories={usage?.categories ?? []}
              />
            )}

            {!usageError && (
              <section className="rounded-[10px] border border-white/10 bg-[#101012] p-3 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)]">
                <div className="mb-3 flex items-center">
                  <div className="text-sm font-bold text-txt">Category Stats</div>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {statCards.map(({ icon, iconColor, iconBgColor, accentColor, label, stats }) => (
                    <NStatCard
                      key={label}
                      variant="usage"
                      icon={icon}
                      iconColor={iconColor}
                      iconBgColor={iconBgColor}
                      accentColor={accentColor}
                      label={label}
                      count={stats.count}
                      used={stats.bytes}
                      total={CATEGORY_QUOTA_BYTES}
                      className="min-h-[104px] px-3 py-3"
                      classNames={{
                        label: 'text-[12px]',
                        description: 'text-[9px]',
                      }}
                    />
                  ))}
                </div>
              </section>
            )}
          </div>
        </aside>

        </div>
      </div>
    </div>
  );
}
