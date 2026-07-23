import React from 'react';
import { Button, Input, NSheet } from 'najm-kit';
import type { NewFolderState } from '../types';

interface Props {
  state: NewFolderState;
  prefix: string;
  onChange: (patch: Partial<NewFolderState>) => void;
  onSubmit: () => void;
  onClose: () => void;
}

export function NewFolderSheet({ state, prefix, onChange, onSubmit, onClose }: Props) {
  return (
    <NSheet
      open={state.open}
      onOpenChange={(v) => { if (!v && !state.busy) onClose(); }}
      title="New folder"
      description={prefix ? `Create folder inside "${prefix}"` : 'Create folder at the bucket root'}
      width={384}
      contentClassName="bg-bg-elev-1"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={state.busy}>Cancel</Button>
          <Button onClick={onSubmit} disabled={state.busy}>Create</Button>
        </div>
      }
    >
      <label className="block text-xs font-medium text-txt-muted mb-1">Folder name</label>
      <Input
        autoFocus
        value={state.name}
        onChange={(e) => onChange({ name: e.target.value })}
        onKeyDown={(e) => { if (e.key === 'Enter') onSubmit(); }}
        placeholder="my-folder"
      />
      {state.error && <p className="mt-2 text-xs text-red-400">{state.error}</p>}
    </NSheet>
  );
}
