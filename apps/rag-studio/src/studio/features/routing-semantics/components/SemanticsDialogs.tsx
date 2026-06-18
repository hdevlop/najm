import { Trash2, Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from 'najm-kit';
import { Button } from 'najm-kit';
import { NConfirmDialog } from 'najm-kit';

interface DeleteSelectedDialogProps {
  open: boolean;
  count: number;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function DeleteSelectedDialog({ open, count, loading, onConfirm, onCancel }: DeleteSelectedDialogProps) {
  return (
    <NConfirmDialog
      open={open}
      title={`Delete ${count} semantic phrase${count === 1 ? '' : 's'}?`}
      description={`This will permanently delete ${count} semantic phrase${count === 1 ? '' : 's'}.`}
      confirmLabel="Delete"
      variant="destructive"
      loading={loading}
      onConfirm={onConfirm}
      onOpenChange={(o) => { if (!o) onCancel(); }}
    />
  );
}

interface ClearAllDialogProps {
  open: boolean;
  totalCount: number;
  loading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ClearAllDialog({ open, totalCount, loading, onConfirm, onCancel }: ClearAllDialogProps) {
  return (
    <NConfirmDialog
      open={open}
      title="Clear all semantic phrases?"
      description={`This will permanently delete all ${totalCount} semantic phrase${totalCount === 1 ? '' : 's'} from the routing index. Tool definitions and settings will stay unchanged.`}
      confirmLabel="Clear All"
      variant="destructive"
      loading={loading}
      onConfirm={onConfirm}
      onOpenChange={(o) => { if (!o) onCancel(); }}
    />
  );
}
