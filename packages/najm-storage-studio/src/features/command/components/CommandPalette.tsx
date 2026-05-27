import React, { useState, useEffect, useMemo } from 'react';
import { Search, BarChart3, FolderOpen } from 'lucide-react';
import { cn } from '../../../lib/utils';
import type { CommandPaletteProps, CommandItem } from '../types';

export function CommandPalette({ open, onClose, buckets, onSelectBucket, onSelectPanel }: CommandPaletteProps) {
  const [q, setQ] = useState('');

  useEffect(() => {
    if (open) setQ('');
  }, [open]);

  const commands = useMemo<CommandItem[]>(() => {
    const list: CommandItem[] = [
      { id: 'dashboard', label: 'Go to Dashboard', icon: BarChart3, action: () => { onSelectPanel('dashboard'); onClose(); } },
      ...buckets.map((b) => ({
        id: `bucket:${b}`,
        label: `Open bucket "${b}"`,
        icon: FolderOpen,
        action: () => { onSelectBucket(b); onClose(); },
      })),
    ];
    return list;
  }, [buckets, onSelectBucket, onSelectPanel, onClose]);

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();
    if (!query) return commands;
    return commands.filter((c) => c.label.toLowerCase().includes(query));
  }, [commands, q]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/60 pt-[20vh] backdrop-blur-sm">
      <div className="w-full max-w-lg rounded-xl border border-white/10 bg-bg-elev-2 shadow-2xl">
        <div className="flex items-center gap-2 border-b border-white/5 px-4 py-3">
          <Search size={16} className="text-txt-muted" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search buckets, files, commands..."
            className="w-full bg-transparent text-sm text-txt outline-none placeholder:text-txt-muted"
            aria-label="Command palette search"
          />
          <kbd className="hidden rounded border border-white/10 bg-bg-elev-1 px-1.5 py-0.5 text-[10px] text-txt-muted sm:inline">ESC</kbd>
        </div>
        <div className="max-h-64 overflow-auto p-2">
          {filtered.map((item) => (
            <button
              key={item.id}
              onClick={item.action}
              className={cn(
                'flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-txt hover:bg-white/5'
              )}
            >
              <item.icon size={14} className="text-txt-muted" />
              {item.label}
            </button>
          ))}
          {!filtered.length && (
            <div className="px-3 py-4 text-center text-xs text-txt-muted">No results</div>
          )}
        </div>
      </div>
    </div>
  );
}
