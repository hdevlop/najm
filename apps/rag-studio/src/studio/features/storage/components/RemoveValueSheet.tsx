import React from 'react';
import { NConfirmDialog } from 'najm-kit';

interface RemoveValueTarget {
  title: string;
  description?: string;
  itemName: string;
  warning?: string;
}

interface RemoveValueSheetProps {
  target: RemoveValueTarget | null;
  busy?: boolean;
  error?: string | null;
  onClose: () => void;
  onConfirm: () => void;
}

export function RemoveValueSheet({
  target,
  busy = false,
  error,
  onClose,
  onConfirm,
}: RemoveValueSheetProps) {
  return (
    <NConfirmDialog
      open={!!target}
      title={target?.title ?? 'Remove item'}
      description={target?.description ?? target?.warning ?? 'This action cannot be undone.'}
      confirmLabel="Remove"
      cancelLabel="Cancel"
      variant="destructive"
      loading={busy}
      onConfirm={onConfirm}
      onOpenChange={(open) => { if (!open && !busy) onClose(); }}
    >
      {target?.warning && target.description && (
        <p className="text-center text-sm text-muted-foreground">{target.warning}</p>
      )}
      {error && <p className="mt-3 text-xs text-red-400">{error}</p>}
    </NConfirmDialog>
  );
}
