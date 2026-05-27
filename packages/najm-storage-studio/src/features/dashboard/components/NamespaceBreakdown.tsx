import React from 'react';
import { Archive, HardDrive } from 'lucide-react';
import { formatBytes } from '../../../lib/format';
import { NEmptyState as EmptyState } from 'najm-ui';
import type { NamespaceItem, NamespaceBreakdownProps } from '../types';

export function NamespaceBreakdown({ namespaces, totalQuota }: NamespaceBreakdownProps) {
  if (!namespaces.length) {
    return <EmptyState icon={HardDrive} title="No namespaces" description="Create a bucket to get started." className="h-full min-h-[150px] rounded-xl border border-white/10 bg-bg-elev-1" />;
  }

  const maxBytes = Math.max(...namespaces.map((n) => n.totalBytes), 1);
  const quota = totalQuota ?? maxBytes * 1.5;

  return (
    <div className="h-full rounded-xl border border-white/10 bg-bg-elev-1 p-4">
      <div className="mb-3 text-sm font-bold text-txt">Namespaces</div>
      <div className="space-y-3">
        {namespaces.map((ns) => {
          const pct = Math.min((ns.totalBytes / quota) * 100, 100);
          return (
            <div key={ns.name} className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <Archive size={14} className="text-brand" />
                  <span className="font-medium text-txt">{ns.name}</span>
                  {ns.isPrivate && (
                    <span className="rounded border border-white/10 px-1 py-0.5 text-[9px] uppercase tracking-wider text-txt-muted">
                      Private
                    </span>
                  )}
                </div>
                <span className="text-txt-muted">{formatBytes(ns.totalBytes)}</span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-brand transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="text-[10px] text-txt-muted">{ns.fileCount.toLocaleString()} files</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
