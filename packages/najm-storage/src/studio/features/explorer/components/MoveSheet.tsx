import React from 'react';
import { Button, Input, NSheet } from 'najm-ui';
import type { MoveState } from '../types';

interface Props {
  state: MoveState | null;
  onChange: (patch: Partial<MoveState>) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function MoveSheet({ state, onChange, onSubmit, onClose }: Props) {
  const count = state?.paths.length ?? 0;
  return (
    <NSheet
      open={!!state}
      onOpenChange={(v) => { if (!v && state && !state.busy) onClose(); }}
      title={`Move ${count} item${count === 1 ? '' : 's'}`}
      description="Enter destination folder (relative to bucket root). Leave empty to move to root."
      width={480}
      contentClassName="bg-bg-elev-1"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={state?.busy}>Cancel</Button>
          <Button onClick={onSubmit} disabled={state?.busy}>Move</Button>
        </div>
      }
    >
      <label className="block text-xs font-medium text-txt-muted mb-1">Destination folder</label>
      <Input
        autoFocus
        value={state?.dest ?? ''}
        onChange={(e) => onChange({ dest: e.target.value })}
        onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(); }}
        placeholder="path/to/folder/"
      />
      {state && state.paths.length > 0 && (
        <div className="mt-3 max-h-40 overflow-auto rounded-lg border border-white/5 bg-bg-elev-1 p-2 text-xs text-txt-muted">
          {state.paths.map((p) => <div key={p} className="truncate">{p}</div>)}
        </div>
      )}
      {state?.error && <p className="mt-2 text-xs text-red-400">{state.error}</p>}
    </NSheet>
  );
}
