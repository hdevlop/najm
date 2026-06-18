import { Dialog, DialogContent } from 'najm-kit';
import { TrashView } from './TrashView';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TrashDialog({ open, onOpenChange }: Props) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[80vh] w-[90vw] max-w-5xl flex-col p-0 overflow-hidden">
        <div className="flex-1 min-h-0">
          <TrashView />
        </div>
      </DialogContent>
    </Dialog>
  );
}
