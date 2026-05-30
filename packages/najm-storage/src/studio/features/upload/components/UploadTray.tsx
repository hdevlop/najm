import React from 'react';
import { X, UploadCloud } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { UploadTask } from '../types';

export function UploadTray({ queue, onRemove }: { queue: UploadTask[]; onRemove: (id: string) => void }) {
  if (!queue.length) return null;
  const pending = queue.filter((q) => q.status !== 'done').length;

  return (
    <div className="fixed bottom-4 right-4 z-50 w-80 rounded-xl border border-white/10 bg-bg-elev-2 shadow-2xl">
      <div className="flex items-center justify-between border-b border-white/5 px-4 py-2">
        <div className="flex items-center gap-2 text-xs font-medium text-txt">
          <UploadCloud size={14} />
          Uploads
          {pending > 0 && <span className="text-txt-muted">({pending} remaining)</span>}
        </div>
      </div>
      <div className="max-h-64 overflow-auto p-2">
        {queue.map((t) => (
          <div key={t.id} className="mb-2 flex items-center gap-2 rounded-lg bg-bg-elev-1 p-2">
            <div className="flex-1">
              <div className="truncate text-xs text-txt">{t.file.name}</div>
              <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-white/10">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    t.status === 'error' ? 'bg-red-500' : 'bg-brand',
                  )}
                  style={{ width: `${t.progress}%` }}
                />
              </div>
            </div>
            <button onClick={() => onRemove(t.id)} className="text-txt-muted hover:text-txt" aria-label="Remove upload">
              <X size={12} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
