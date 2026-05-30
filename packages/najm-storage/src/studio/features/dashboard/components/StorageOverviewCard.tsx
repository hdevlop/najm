import React from 'react';
import {
  PieChart,
  Pie,
  Cell,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import {
  Image,
  FileText,
  Table,
  Presentation,
  Code2,
  Briefcase,
  Headphones,
  Film,
  Database,
  Settings,
  Package,
  HardDrive,
} from 'lucide-react';
import type { StorageOverviewCardProps } from '../types';
import { STORAGE_QUOTA_BYTES } from '../constants';

function formatOverviewBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const unit = 1024;
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(unit)), units.length - 1);
  const value = bytes / Math.pow(unit, index);
  if (index === 0) return `${Math.round(value)} ${units[index]}`;
  if (value >= 10 || Number.isInteger(value)) return `${Math.round(value)} ${units[index]}`;
  return `${value.toFixed(1)} ${units[index]}`;
}

function normalizeCategory(category: string): string {
  return category.toLowerCase().replace(/[^a-z0-9]/g, '');
}

interface OverviewRowDef {
  title: string;
  keys: string[];
  icon: React.ElementType;
  color: string;
  bgColor: string;
}

const overviewRows: OverviewRowDef[] = [
  {
    title: 'Images',
    keys: ['image', 'images', 'img', 'picture', 'pictures', 'photo', 'photos', 'avatar', 'avatars'],
    icon: Image,
    color: '#3f86ff',
    bgColor: 'rgba(63,134,255,0.12)',
  },
  {
    title: 'Documents',
    keys: ['document', 'documents', 'doc', 'docs', 'pdf', 'text', 'word', 'letter', 'markdown', 'md'],
    icon: FileText,
    color: '#25d88d',
    bgColor: 'rgba(37,216,141,0.12)',
  },
  {
    title: 'Spreadsheets',
    keys: ['spreadsheet', 'spreadsheets', 'sheet', 'sheets', 'excel', 'csv', 'xls', 'xlsx'],
    icon: Table,
    color: '#34d399',
    bgColor: 'rgba(52,211,153,0.12)',
  },
  {
    title: 'Presentations',
    keys: ['presentation', 'presentations', 'ppt', 'slide', 'slides', 'deck', 'keynote'],
    icon: Presentation,
    color: '#f472b6',
    bgColor: 'rgba(244,114,182,0.12)',
  },
  {
    title: 'Code',
    keys: ['code', 'script', 'scripts', 'source', 'json', 'xml', 'yaml', 'yml', 'html', 'css', 'js', 'ts'],
    icon: Code2,
    color: '#a78bfa',
    bgColor: 'rgba(167,139,250,0.12)',
  },
  {
    title: 'Projects',
    keys: ['project', 'projects', 'repo', 'repository'],
    icon: Briefcase,
    color: '#60a5fa',
    bgColor: 'rgba(96,165,250,0.12)',
  },
  {
    title: 'Audio',
    keys: ['audio', 'music', 'sound', 'podcast', 'voice', 'mp3', 'wav', 'ogg'],
    icon: Headphones,
    color: '#fbbf24',
    bgColor: 'rgba(251,191,36,0.12)',
  },
  {
    title: 'Video',
    keys: ['video', 'videos', 'movie', 'film', 'mp4', 'mov', 'avi'],
    icon: Film,
    color: '#c084fc',
    bgColor: 'rgba(192,132,252,0.12)',
  },
  {
    title: 'Database',
    keys: ['database', 'db', 'sql', 'sqlite', 'data'],
    icon: Database,
    color: '#22d3ee',
    bgColor: 'rgba(34,211,238,0.12)',
  },
  {
    title: 'Config',
    keys: ['config', 'configuration', 'settings', 'env', 'dotfile', 'dotfiles'],
    icon: Settings,
    color: '#94a3b8',
    bgColor: 'rgba(148,163,184,0.12)',
  },
  {
    title: 'Archive',
    keys: ['archive', 'archives', 'zip', 'tar', 'gz', 'rar', '7z', 'backup', 'backups'],
    icon: Package,
    color: '#737780',
    bgColor: 'rgba(115,119,128,0.12)',
  },
];

function sumCategories(categories: StorageOverviewCardProps['categories'], keys: string[]) {
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

export function StorageOverviewCard({ totalBytes, totalCount, categories, orientation = 'vertical' }: StorageOverviewCardProps & { orientation?: 'vertical' | 'horizontal' }) {
  const isHorizontal = orientation === 'horizontal';
  const computedRows = overviewRows.map((row) => ({
    ...row,
    ...sumCategories(categories, row.keys),
  }));

  const knownBytes = computedRows.reduce((total, row) => total + row.bytes, 0);
  const hiddenBytes = Math.max(totalBytes - knownBytes, 0);
  const freeBytes = Math.max(STORAGE_QUOTA_BYTES - totalBytes, 0);

  // Merge hidden bytes into Archive so there is no "Others" row
  const archiveIndex = computedRows.findIndex((r) => r.title === 'Archive');
  if (archiveIndex >= 0 && hiddenBytes > 0) {
    computedRows[archiveIndex] = {
      ...computedRows[archiveIndex],
      bytes: computedRows[archiveIndex].bytes + hiddenBytes,
    };
  }

  const usedPct = STORAGE_QUOTA_BYTES > 0 ? Math.min((totalBytes / STORAGE_QUOTA_BYTES) * 100, 100) : 0;

  // Donut shows only used categories (proportional to each other), no free-space segment
  const donutData = computedRows
    .filter((r) => r.bytes > 0)
    .map((r) => ({ name: r.title, value: r.bytes, color: r.color }));

  // List rows: categories with data first (sorted desc), then empty ones, then free space
  const rowsWithData = computedRows
    .filter((r) => r.bytes > 0)
    .sort((a, b) => b.bytes - a.bytes);
  const rowsWithoutData = computedRows.filter((r) => r.bytes === 0);

  return (
    <div
      className={`flex rounded-[10px] border border-white/[0.08] bg-[#111113] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] ${isHorizontal ? 'flex-row items-center gap-6' : 'shrink-0 flex-col'}`}
      aria-label={`Storage overview ${formatOverviewBytes(totalBytes)} used across ${totalCount.toLocaleString()} files`}
    >
      <div className={isHorizontal ? 'flex w-[220px] shrink-0 flex-col items-center' : 'flex shrink-0 flex-col items-center'}>
      <div className={isHorizontal ? 'self-start text-sm font-semibold tracking-tight text-white' : 'self-start text-sm font-semibold tracking-tight text-white'}>Storage Overview</div>

      {/* Donut Chart */}
      <div className={`relative mx-auto h-[180px] w-full max-w-[220px] ${isHorizontal ? 'mt-1' : 'mt-2'}`}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={donutData}
              cx="50%"
              cy="50%"
              innerRadius={58}
              outerRadius={78}
              paddingAngle={2}
              dataKey="value"
              stroke="none"
              startAngle={90}
              endAngle={-270}
            >
              {donutData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value: number, name: string) => [formatOverviewBytes(value), name]}
              contentStyle={{
                backgroundColor: '#141414',
                border: '1px solid #27272a',
                borderRadius: '8px',
                fontSize: '12px',
                color: '#e4e4e7',
              }}
              itemStyle={{ color: '#a1a1aa' }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Center text */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <div className="text-[22px] font-extrabold leading-none tracking-tight text-white">
            {formatOverviewBytes(totalBytes)}
          </div>
          <div className="mt-1 text-[10px] font-medium uppercase tracking-wider text-[#6b7280]">
            of {formatOverviewBytes(STORAGE_QUOTA_BYTES)}
          </div>
          <div className="mt-1 text-[11px] font-semibold text-[#4b8dff]">
            {usedPct < 0.1 ? '<0.1%' : `${usedPct.toFixed(1)}%`} used
          </div>
        </div>
      </div>

      {/* Upgrade link */}
      <button
        type="button"
        className="mx-auto mt-1 text-xs font-semibold text-[#4b8dff] transition-colors hover:text-[#78aaff] focus:outline-none"
      >
        Upgrade plan
      </button>
      </div>

      {/* Divider (vertical-only) */}
      {!isHorizontal && <div className="mx-[-16px] mt-3 h-px bg-white/[0.04]" />}

      {/* Category breakdown */}
      <div className={isHorizontal
        ? 'grid min-w-0 flex-1 grid-cols-2 gap-x-3 gap-y-0 sm:grid-cols-3 xl:grid-cols-4'
        : 'ss-scrollbar mt-2 max-h-[250px] space-y-0.5 overflow-auto pr-1'
      }>
        {rowsWithData.map((row) => {
          const Icon = row.icon;
          const pct = totalBytes > 0 ? (row.bytes / totalBytes) * 100 : 0;
          return (
            <div
              key={row.title}
              className="flex items-center justify-between gap-3 rounded-lg px-2 py-[6px] transition-colors hover:bg-white/[0.02]"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <div
                  className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px]"
                  style={{ backgroundColor: row.bgColor }}
                >
                  <Icon size={14} strokeWidth={2} style={{ color: row.color }} />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-medium leading-4 text-white">{row.title}</div>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[11px] font-semibold tabular-nums text-white/90">
                  {formatOverviewBytes(row.bytes)}
                </div>
                <div className="text-[10px] font-medium tabular-nums text-[#525866]">
                  {pct > 0 ? `${pct.toFixed(1)}%` : '0%'}
                </div>
              </div>
            </div>
          );
        })}

        {rowsWithoutData.map((row) => {
          const Icon = row.icon;
          return (
            <div
              key={row.title}
              className="flex items-center justify-between gap-3 rounded-lg px-2 py-[6px] transition-colors hover:bg-white/[0.02]"
            >
              <div className="flex min-w-0 items-center gap-2.5">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-white/[0.03]">
                  <Icon size={14} strokeWidth={2} className="text-[#3f4149]" />
                </div>
                <div className="min-w-0">
                  <div className="truncate text-[12px] font-medium leading-4 text-[#525866]">{row.title}</div>
                </div>
              </div>
              <div className="shrink-0 text-right">
                <div className="text-[11px] font-medium tabular-nums text-[#3f4149]">0 B</div>
                <div className="text-[10px] font-medium tabular-nums text-[#3f4149]">0%</div>
              </div>
            </div>
          );
        })}

        {/* Free space */}
        <div className="flex items-center justify-between gap-3 rounded-lg px-2 py-[6px] transition-colors hover:bg-white/[0.02]">
          <div className="flex min-w-0 items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-[8px] bg-[rgba(26,27,32,0.6)]">
              <HardDrive size={14} strokeWidth={2} className="text-[#3f4149]" />
            </div>
            <div className="min-w-0">
              <div className="truncate text-[12px] font-medium leading-4 text-[#525866]">Free space</div>
            </div>
          </div>
          <div className="shrink-0 text-right">
            <div className="text-[11px] font-medium tabular-nums text-[#525866]">{formatOverviewBytes(freeBytes)}</div>
            <div className="text-[10px] font-medium tabular-nums text-[#525866]">
              {((freeBytes / STORAGE_QUOTA_BYTES) * 100).toFixed(1)}%
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
