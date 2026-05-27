import React, { useCallback, useEffect, useState, useRef, useMemo } from 'react';
import { NSidebar } from 'najm-ui';
import {
  BarChart3, Archive, HardDrive,
} from 'lucide-react';
import { ExplorerView } from '../features/explorer';
import { DashboardView } from '../features/dashboard';
import { DropZone } from '../features/upload/components/DropZone';
import { UploadTray } from '../features/upload/components/UploadTray';
import { useUpload } from '../features/upload/hooks/useUpload';
import { useBuckets } from '../features/dashboard/hooks/useBuckets';
import { useUsage } from '../features/dashboard/hooks/useUsage';
import { STORAGE_QUOTA_BYTES } from '../features/dashboard/constants';
import { formatBytes } from '../lib/format';
import { useKeyboard } from '../shared/hooks/useKeyboard';
import { CommandPalette } from '../features/command/components/CommandPalette';
import {
  readStorageStudioUrlState,
  writeStorageStudioUrlState,
  type StorageStudioPanel,
  type StorageStudioView,
} from './urlState';

export function StorageStudioApp() {
  const initialUrlState = useMemo(() => readStorageStudioUrlState(), []);
  const [activePanel, setActivePanel] = useState<StorageStudioPanel>(initialUrlState.panel);
  const [activeBucket, setActiveBucket] = useState<string | null>(initialUrlState.bucket);
  const [view, setView] = useState<StorageStudioView>(initialUrlState.view);
  const [prefix, setPrefix] = useState(initialUrlState.prefix);
  const [paletteOpen, setPaletteOpen] = useState(false);

  const searchRef = useRef<HTMLInputElement>(null);
  const { data: bucketsData } = useBuckets();
  const { data: usage } = useUsage();
  const { queue, addFiles, removeTask } = useUpload(activeBucket ?? '');
  const canUpload = activePanel === 'explorer' && activeBucket;
  const usedBytes = usage?.totalBytes ?? 0;
  const usedPct = STORAGE_QUOTA_BYTES > 0 ? Math.min((usedBytes / STORAGE_QUOTA_BYTES) * 100, 100) : 0;

  const navItems = useMemo(() => [
    { id: 'dashboard', label: 'Overview Dashboard', icon: BarChart3, sectionLabel: 'Overview' },
    ...(bucketsData ?? []).map((b) => ({
      id: `bucket:${b.name}`,
      label: b.name,
      icon: Archive,
      sectionLabel: 'Buckets',
    })),
  ], [bucketsData]);

  const activePath = useMemo(() => {
    if (activePanel === 'explorer' && activeBucket) return `bucket:${activeBucket}`;
    return activePanel;
  }, [activePanel, activeBucket]);

  useEffect(() => {
    const handlePopState = () => {
      const next = readStorageStudioUrlState();
      setActivePanel(next.panel);
      setActiveBucket(next.bucket);
      setPrefix(next.prefix);
      setView(next.view);
    };
    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const navigateTo = useCallback((state: {
    panel: StorageStudioPanel;
    bucket?: string | null;
    prefix?: string;
    view?: StorageStudioView;
  }, mode: 'push' | 'replace' = 'push') => {
    const next = {
      panel: state.panel,
      bucket: state.bucket ?? null,
      prefix: state.prefix ?? '',
      view: state.view ?? view,
    };
    setActivePanel(next.panel);
    setActiveBucket(next.bucket);
    setPrefix(next.prefix);
    setView(next.view);
    writeStorageStudioUrlState(next, mode);
  }, [view]);

  const handleNavigate = (href: string) => {
    if (href.startsWith('bucket:')) {
      const bucket = href.slice(7);
      navigateTo({
        panel: 'explorer',
        bucket,
        prefix: '',
        view,
      });
    } else {
      navigateTo({ panel: href === 'explorer' ? 'explorer' : 'dashboard', bucket: null, prefix: '', view });
    }
  };

  const handleSelectBucket = (bucket: string) => {
    handleNavigate(`bucket:${bucket}`);
  };

  const handleSelectPanel = (panel: string) => {
    handleNavigate(panel);
  };

  useKeyboard({
    onSearch: () => searchRef.current?.focus(),
    onCommandPalette: () => setPaletteOpen((p) => !p),
    onEscape: () => setPaletteOpen(false),
  });

  return (
    <div className="flex h-[100dvh] w-full bg-bg text-txt">
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
      <div className="flex flex-1 flex-col">
        <DropZone onDrop={canUpload ? (files) => addFiles(files, activeBucket) : () => {}}>
          <main className="flex-1 overflow-hidden h-full">
            {activePanel === 'explorer' && activeBucket && (
              <ExplorerView
                key={activeBucket}
                bucket={activeBucket}
                view={view}
                onViewChange={(nextView) => {
                  setView(nextView);
                  writeStorageStudioUrlState({ panel: 'explorer', bucket: activeBucket, prefix, view: nextView });
                }}
                prefix={prefix}
                onPrefixChange={(nextPrefix) => {
                  setPrefix(nextPrefix);
                  writeStorageStudioUrlState({ panel: 'explorer', bucket: activeBucket, prefix: nextPrefix, view }, 'push');
                }}
              />
            )}
            {activePanel === 'dashboard' && (
              <DashboardView
                searchRef={searchRef}
              />
            )}
          </main>
        </DropZone>
        <CommandPalette
          open={paletteOpen}
          onClose={() => setPaletteOpen(false)}
          buckets={(bucketsData ?? []).map((b) => b.name)}
          onSelectBucket={handleSelectBucket}
          onSelectPanel={handleSelectPanel}
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
      </div>
    </div>
  );
}
