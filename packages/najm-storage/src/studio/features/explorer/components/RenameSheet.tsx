import React from 'react';
import { Button, Input, NSheet } from 'najm-kit';
import type { RenameState } from '../types';

interface Props {
  state: RenameState | null;
  onChange: (patch: Partial<RenameState>) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function RenameSheet({ state, onChange, onSubmit, onClose }: Props) {
  return (
    <NSheet
      open={!!state}
      onOpenChange={(v) => { if (!v && state && !state.busy) onClose(); }}
      title="Rename"
      description={state?.path}
      width={384}
      contentClassName="bg-bg-elev-1"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={state?.busy}>Cancel</Button>
          <Button onClick={onSubmit} disabled={state?.busy}>Rename</Button>
        </div>
      }
    >
      <label className="block text-xs font-medium text-txt-muted mb-1">New name</label>
      <Input
        autoFocus
        value={state?.value ?? ''}
        onChange={(e) => onChange({ value: e.target.value })}
        onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(); }}
      />
      {state?.error && <p className="mt-2 text-xs text-red-400">{state.error}</p>}
    </NSheet>
  );
}
