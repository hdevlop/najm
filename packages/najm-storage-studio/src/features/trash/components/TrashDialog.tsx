import { Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from 'najm-ui';
import { TrashView } from './TrashView';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TrashDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[80vh] w-[90vw] max-w-5xl flex-col gap-4 p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Trash2 size={16} /> Trash
          </DialogTitle>
          <DialogDescription>Restore or permanently delete files</DialogDescription>
        </DialogHeader>
        <div className="flex-1 min-h-0">
          <TrashView />
        </div>
      </DialogContent>
    </Dialog>
  );
}
