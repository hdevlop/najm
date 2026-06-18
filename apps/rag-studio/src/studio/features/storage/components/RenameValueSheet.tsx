import React, { useEffect, useState } from 'react';
import { Button, Input, NSheet } from 'najm-kit';

interface RenameValueTarget {
  title: string;
  description?: string;
  label: string;
  initialValue: string;
  placeholder?: string;
}

interface RenameValueSheetProps {
  target: RenameValueTarget | null;
  busy?: boolean;
  error?: string | null;
  submitLabel?: string;
  allowUnchanged?: boolean;
  onClose: () => void;
  onSubmit: (value: string) => void;
}

export function RenameValueSheet({
  target,
  busy = false,
  error,
  submitLabel = 'Rename',
  allowUnchanged = false,
  onClose,
  onSubmit,
}: RenameValueSheetProps) {
  const [value, setValue] = useState('');
  const trimmed = value.trim();
  const canSubmit = !!trimmed && (allowUnchanged || trimmed !== target?.initialValue.trim()) && !busy;

  useEffect(() => {
    setValue(target?.initialValue ?? '');
  }, [target]);

  const submit = () => {
    if (canSubmit) onSubmit(trimmed);
  };

  return (
    <NSheet
      open={!!target}
      onOpenChange={(open) => { if (!open && !busy) onClose(); }}
      title={target?.title ?? 'Rename'}
      description={target?.description}
      width={384}
      contentClassName="bg-bg-elev-1"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={busy}>Cancel</Button>
          <Button onClick={submit} disabled={!canSubmit}>{submitLabel}</Button>
        </div>
      }
    >
      <label className="mb-1 block text-xs font-medium text-txt-muted">{target?.label ?? 'New name'}</label>
      <Input
        autoFocus
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => { if (e.key === 'Enter') submit(); }}
        placeholder={target?.placeholder}
      />
      {error && <p className="mt-2 text-xs text-red-400">{error}</p>}
    </NSheet>
  );
}
