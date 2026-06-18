import React, { useState } from 'react';
import { ChevronsLeftRight, LogOut, Server } from 'lucide-react';
import { useStudioAuth } from '@/lib/useStudioAuth';

interface ConnectionPillProps {
  name: string;
  onSwitch: () => void;
}

/**
 * Floating control (top-right) in standalone mode showing the active app and
 * letting the operator switch apps or log out. Rendered inside the provider so
 * it can reach the auth store.
 */
export function ConnectionPill({ name, onSwitch }: ConnectionPillProps) {
  const { logout } = useStudioAuth();
  const [open, setOpen] = useState(false);

  return (
    <div className="fixed right-4 top-3 z-50 flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-border bg-card/90 px-3 py-1.5 text-xs font-medium text-txt-primary shadow-card backdrop-blur transition hover:bg-card-hover"
      >
        <Server className="h-3.5 w-3.5 text-brand" />
        <span className="max-w-[180px] truncate">{name}</span>
      </button>

      {open && (
        <div className="flex w-44 flex-col overflow-hidden rounded-lg border border-border bg-card shadow-card">
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              onSwitch();
            }}
            className="flex items-center gap-2 px-3 py-2 text-left text-xs text-txt-primary transition hover:bg-card-hover"
          >
            <ChevronsLeftRight className="h-3.5 w-3.5" />
            Switch app
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              logout();
            }}
            className="flex items-center gap-2 px-3 py-2 text-left text-xs text-status-red transition hover:bg-card-hover"
          >
            <LogOut className="h-3.5 w-3.5" />
            Log out
          </button>
        </div>
      )}
    </div>
  );
}
