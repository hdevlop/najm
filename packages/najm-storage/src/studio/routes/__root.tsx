import React, { useCallback, useMemo, useRef, useState } from 'react';
import { createRootRoute, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { NSidebar } from 'najm-ui';
import { BarChart3, Archive, HardDrive, Trash2, Link, Tag } from 'lucide-react';
import { useBuckets } from '@/features/dashboard/hooks/useBuckets';
import { useUsage } from '@/features/dashboard/hooks/useUsage';
import { STORAGE_QUOTA_BYTES } from '@/features/dashboard/constants';
import { formatBytes } from '@/lib/format';
import { useKeyboard } from '@/shared/hooks/useKeyboard';
import { CommandPalette } from '@/features/command/components/CommandPalette';
import { DropZone } from '@/features/upload/components/DropZone';
import { UploadTray } from '@/features/upload/components/UploadTray';
import { useUpload } from '@/features/upload/hooks/useUpload';

export const rootRoute = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const search = useRouterState({ select: (s) => s.location.search });

  const [paletteOpen, setPaletteOpen] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);
  const { data: bucketsData } = useBuckets();
  const { data: usage } = useUsage();

  const activeBucket = (search as any)?.bucket as string | undefined;
  const canUpload = !!activeBucket;
  const { queue, addFiles, removeTask } = useUpload(activeBucket ?? '');

  const usedBytes = usage?.totalBytes ?? 0;
  const usedPct = STORAGE_QUOTA_BYTES > 0 ? Math.min((usedBytes / STORAGE_QUOTA_BYTES) * 100, 100) : 0;

  const navItems = useMemo(() => [
    { id: 'dashboard', label: 'Overview Dashboard', icon: BarChart3, sectionLabel: 'Overview' },
    ...(bucketsData ?? []).map((b: any) => ({
      id: `bucket:${b.name}`,
      label: b.name,
      icon: Archive,
      sectionLabel: 'Buckets',
    })),
    { id: 'trash', label: 'Trash', icon: Trash2, sectionLabel: 'Management' },
    { id: 'shared', label: 'Shared', icon: Link, sectionLabel: 'Management' },
    { id: 'tags', label: 'Tags', icon: Tag, sectionLabel: 'Management' },
  ], [bucketsData]);

  const activePath = useMemo(() => {
    if (pathname === '/trash') return 'trash';
    if (pathname === '/shared') return 'shared';
    if (pathname === '/tags') return 'tags';
    if (activeBucket) return `bucket:${activeBucket}`;
    return 'dashboard';
  }, [pathname, activeBucket]);

  const handleNavigate = useCallback((href: string) => {
    if (href.startsWith('bucket:')) {
      const bucket = href.slice(7);
      navigate({ to: '/explorer', search: { bucket, prefix: '', view: 'grid' } });
    } else if (href === 'trash') {
      navigate({ to: '/trash' });
    } else if (href === 'shared') {
      navigate({ to: '/shared' });
    } else if (href === 'tags') {
      navigate({ to: '/tags' });
    } else {
      navigate({ to: '/' });
    }
  }, [navigate]);

  useKeyboard({
    onSearch: () => searchRef.current?.focus(),
    onCommandPalette: () => setPaletteOpen((p) => !p),
    onEscape: () => setPaletteOpen(false),
  });

  return (
    <div className="dark h-full w-full">
      <div className="flex h-full w-full overflow-hidden bg-bg">
        <NSidebar
          logo={
            <button
              type="button"
              onClick={() => handleNavigate('dashboard')}
              className="flex w-full items-center gap-2.5 min-w-0 rounded-md text-left hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/40"
              aria-label="Go to dashboard"
            >
              <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <HardDrive className="h-5 w-5 text-primary" />
              </div>
              <div className="flex flex-col min-w-0">
                <span className="text-sm font-semibold text-foreground leading-tight truncate">Storage Studio</span>
                <span className="text-xs text-muted-foreground leading-tight truncate">Asset Management</span>
              </div>
            </button>
          }
          navItems={navItems}
          activePath={activePath}
          onNavigate={handleNavigate}
          showSectionSeparators
          footer={
            <div className="px-3 py-2">
              <div className="mb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-txt-muted">Storage Quota</div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div className="h-full rounded-full bg-brand" style={{ width: `${usedPct}%` }} />
              </div>
              <div className="mt-1 text-xs text-txt-muted">
                {formatBytes(usedBytes)} / {formatBytes(STORAGE_QUOTA_BYTES)}
              </div>
            </div>
          }
        />
        <main className="flex-1 h-full overflow-hidden flex flex-col min-w-0">
          <DropZone onDrop={canUpload ? (files) => addFiles(files, activeBucket!) : () => {}}>
            <div className="h-full">
              <Outlet />
            </div>
          </DropZone>
          <CommandPalette
            open={paletteOpen}
            onClose={() => setPaletteOpen(false)}
            buckets={(bucketsData ?? []).map((b: any) => b.name)}
            onSelectBucket={(bucket) => navigate({ to: '/explorer', search: { bucket, prefix: '', view: 'grid' } })}
            onSelectPanel={(panel) => { if (panel === 'dashboard') navigate({ to: '/' }); }}
          />
          <UploadTray queue={queue} onRemove={removeTask} />
          <input
            id="ss-file-input"
            type="file"
            multiple
            className="hidden"
            disabled={!canUpload}
            onChange={(e) => { if (canUpload) { addFiles(e.target.files, activeBucket!); e.target.value = ''; } }}
          />
        </main>
      </div>
    </div>
  );
}
