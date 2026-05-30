import { AlertTriangle, Copy, FileX2 } from 'lucide-react';
import { Button, Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from 'najm-ui';
import type { PasteConflictState } from '../hooks/useExplorerClipboard';

interface Props {
  state: PasteConflictState | null;
  onReplace: () => void;
  onSkip: () => void;
  onKeepBoth: () => void;
  onCancel: () => void;
}

export function PasteConflictDialog({ state, onReplace, onSkip, onKeepBoth, onCancel }: Props) {
  return (
    <Dialog open={!!state} onOpenChange={(open) => { if (!open) onCancel(); }}>
      <DialogContent className="max-w-md border-white/10 bg-bg-elev-1 text-txt">
        <DialogHeader>
          <div className="mb-2 flex size-10 items-center justify-center rounded-lg bg-amber-400/10 text-amber-300">
            <AlertTriangle size={20} />
          </div>
          <DialogTitle className="text-base">File already exists</DialogTitle>
          <DialogDescription>
            A file named "{state?.name}" already exists in this folder.
          </DialogDescription>
        </DialogHeader>

        {state && (
          <div className="space-y-2 rounded-lg border border-white/10 bg-bg p-3 text-xs">
            <div className="flex items-start gap-2">
              <FileX2 size={14} className="mt-0.5 shrink-0 text-txt-muted" />
              <div className="min-w-0">
                <div className="text-txt-muted">Existing destination</div>
                <div className="truncate text-txt">{state.target}</div>
              </div>
            </div>
            <div className="flex items-start gap-2">
              <Copy size={14} className="mt-0.5 shrink-0 text-txt-muted" />
              <div className="min-w-0">
                <div className="text-txt-muted">{state.mode === 'cut' ? 'Moving from' : 'Copying from'}</div>
                <div className="truncate text-txt">{state.source}</div>
              </div>
            </div>
            {state.total > 1 && (
              <div className="border-t border-white/10 pt-2 text-txt-muted">
                Item {state.index} of {state.total}
              </div>
            )}
          </div>
        )}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <div className="flex flex-wrap justify-end gap-2">
            <Button variant="outline" onClick={onSkip}>Skip</Button>
            <Button variant="secondary" onClick={onKeepBoth}>Keep both</Button>
            <Button variant="destructive" onClick={onReplace}>Replace</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
