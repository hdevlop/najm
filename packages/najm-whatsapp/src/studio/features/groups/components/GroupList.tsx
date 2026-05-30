import React from 'react';
import { Users, Shield } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { Group } from '@/features/groups/types';

interface GroupListProps {
  groups: Group[];
  selectedJid?: string | null;
  onSelect?: (jid: string) => void;
}

export function GroupList({ groups, selectedJid, onSelect }: GroupListProps) {
  return (
    <div className="flex flex-col gap-1 overflow-y-auto">
      {groups.map((group) => (
        <button
          key={group.jid}
          onClick={() => onSelect?.(group.jid)}
          className={cn(
            'flex items-center gap-3 rounded-md px-3 py-2 text-left transition-colors',
            selectedJid === group.jid
              ? 'bg-surface text-txt-primary'
              : 'hover:bg-card-hover text-txt-secondary'
          )}
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-txt-muted">
            <Users size={16} />
          </div>
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-sm font-medium text-txt-primary">{group.subject}</span>
            <span className="truncate text-xs text-txt-muted">{group.jid}</span>
          </div>
          <div className="ml-auto flex items-center gap-2">
            {group.isAdmin && <Shield size={14} className="text-brand" />}
            {typeof group.participantCount === 'number' && (
              <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] text-txt-muted">
                {group.participantCount}
              </span>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
