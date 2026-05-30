import React, { useEffect, useState } from 'react';
import { QrCode } from 'lucide-react';
import { useStudio } from '@/lib/context';
import { useApiClient } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { Instance } from '@/features/instances/types';

export function SidebarInstance() {
  const { selectedInstanceId } = useStudio();
  const api = useApiClient();
  const [instance, setInstance] = useState<Instance | null>(null);

  useEffect(() => {
    if (!selectedInstanceId) {
      setInstance(null);
      return;
    }
    api.get('/instances')
      .then((data: Instance[]) => {
        const found = data?.find((i) => i.id === selectedInstanceId);
        setInstance(found || null);
      })
      .catch(() => setInstance(null));
  }, [api, selectedInstanceId]);

  const status = instance?.status || 'disconnected';
  const statusMap: Record<string, { dot: string; label: string }> = {
    connected: { dot: 'bg-status-green', label: 'Connected' },
    connecting: { dot: 'bg-status-yellow', label: 'Connecting…' },
    error: { dot: 'bg-status-red', label: 'Error' },
    disconnected: { dot: 'bg-txt-muted', label: 'Disconnected' },
  };

  const { dot, label } = statusMap[status] || statusMap.disconnected;

  return (
    <div className="mx-3 mb-2 mt-2">
      <button
        className="flex w-full items-center gap-3 rounded-xl bg-card px-3 py-2.5 text-left transition-colors hover:bg-card-hover"
        title={selectedInstanceId ?? 'No instance selected'}
      >
        <div className="relative shrink-0">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-surface">
            <QrCode className="h-4 w-4 text-txt-secondary" />
          </div>
          <span
            className={cn(
              'absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full border-2 border-card',
              dot
            )}
          />
        </div>
        <div className="flex min-w-0 flex-col">
          <span className="truncate text-sm font-semibold text-txt-primary">
            {instance ? label : 'Needs QR'}
          </span>
          <span className="truncate text-xs text-txt-muted">
            {selectedInstanceId ? 'Tap to manage' : 'Select an instance'}
          </span>
        </div>
      </button>
    </div>
  );
}
