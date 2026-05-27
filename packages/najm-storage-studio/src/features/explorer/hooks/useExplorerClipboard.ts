import { useCallback, useState } from 'react';
import { toast } from 'sonner';
import type { Clipboard } from '../types';
import type { ExplorerMutations } from './useExplorerMutations';

/**
 * Cut/copy/paste state machine. Paste reads the clipboard and dispatches the
 * appropriate mutation (move for cut, copy for copy), then clears the
 * clipboard on cut.
 */
export function useExplorerClipboard(mutations: ExplorerMutations, prefix: string) {
  const [clipboard, setClipboard] = useState<Clipboard>(null);

  const cut = useCallback((paths: string[]) => setClipboard({ mode: 'cut', paths }), []);
  const copy = useCallback((paths: string[]) => setClipboard({ mode: 'copy', paths }), []);
  const clear = useCallback(() => setClipboard(null), []);

  const paste = useCallback(async () => {
    if (!clipboard?.paths.length) return;
    try {
      for (const src of clipboard.paths) {
        const name = src.split('/').pop()!;
        const to = `${prefix ?? ''}${name}`;
        if (src === to) continue;
        if (clipboard.mode === 'cut') await mutations.move(src, to);
        else await mutations.copy(src, to);
      }
      setClipboard(null);
      mutations.refresh();
    } catch (e: any) {
      toast.error(e?.message ?? 'Paste failed');
    }
  }, [clipboard, prefix, mutations]);

  return { clipboard, cut, copy, paste, clear, hasClipboard: !!clipboard?.paths.length };
}

export type ExplorerClipboard = ReturnType<typeof useExplorerClipboard>;
