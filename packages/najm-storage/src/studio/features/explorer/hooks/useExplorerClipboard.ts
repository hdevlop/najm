import { useCallback, useRef, useState } from 'react';
import { toast } from 'sonner';
import type { Clipboard } from '../types';
import type { ExplorerMutations } from './useExplorerMutations';

export type PasteConflictAction = 'replace' | 'skip' | 'keep-both' | 'cancel';

export interface PasteConflictState {
  source: string;
  target: string;
  name: string;
  mode: 'cut' | 'copy';
  index: number;
  total: number;
}

export function getPasteTarget(source: string, prefix: string) {
  const name = source.split('/').pop()!;
  return { name, target: `${prefix ?? ''}${name}` };
}

export function getKeepBothPath(target: string, occupiedPaths: Set<string>): string {
  const slashIndex = target.lastIndexOf('/');
  const folder = slashIndex >= 0 ? target.slice(0, slashIndex + 1) : '';
  const fileName = slashIndex >= 0 ? target.slice(slashIndex + 1) : target;
  const dotIndex = fileName.lastIndexOf('.');
  const hasExtension = dotIndex > 0;
  const base = hasExtension ? fileName.slice(0, dotIndex) : fileName;
  const ext = hasExtension ? fileName.slice(dotIndex) : '';

  let candidate = `${folder}${base} - Copy${ext}`;
  let counter = 2;
  while (occupiedPaths.has(candidate)) {
    candidate = `${folder}${base} - Copy (${counter})${ext}`;
    counter += 1;
  }
  return candidate;
}

/**
 * Cut/copy/paste state machine. Paste reads the clipboard and dispatches the
 * appropriate mutation (move for cut, copy for copy), then clears the
 * clipboard on cut.
 */
export function useExplorerClipboard(mutations: ExplorerMutations, prefix: string, existingPaths: string[] = []) {
  const [clipboard, setClipboard] = useState<Clipboard>(null);
  const [conflict, setConflict] = useState<PasteConflictState | null>(null);
  const [pasting, setPasting] = useState(false);
  const conflictResolver = useRef<((action: PasteConflictAction) => void) | null>(null);

  const cut = useCallback((paths: string[]) => setClipboard({ mode: 'cut', paths }), []);
  const copy = useCallback((paths: string[]) => setClipboard({ mode: 'copy', paths }), []);
  const clear = useCallback(() => setClipboard(null), []);

  const askConflict = useCallback((state: PasteConflictState) => (
    new Promise<PasteConflictAction>((resolve) => {
      conflictResolver.current = resolve;
      setConflict(state);
    })
  ), []);

  const resolveConflict = useCallback((action: PasteConflictAction) => {
    conflictResolver.current?.(action);
    conflictResolver.current = null;
    setConflict(null);
  }, []);

  const paste = useCallback(async () => {
    if (!clipboard?.paths.length || pasting) return;
    setPasting(true);
    const occupiedPaths = new Set(existingPaths);
    try {
      for (const [index, src] of clipboard.paths.entries()) {
        const { name, target } = getPasteTarget(src, prefix);
        if (clipboard.mode === 'cut' && src === target) continue;

        let to = target;
        let overwrite = false;

        if (occupiedPaths.has(to)) {
          const action = await askConflict({
            source: src,
            target: to,
            name,
            mode: clipboard.mode,
            index: index + 1,
            total: clipboard.paths.length,
          });
          if (action === 'cancel') return;
          if (action === 'skip') continue;
          if (action === 'keep-both') {
            to = getKeepBothPath(to, occupiedPaths);
          } else {
            overwrite = true;
          }
        }

        if (src === to) continue;
        if (clipboard.mode === 'cut') await mutations.move(src, to, { overwrite });
        else await mutations.copy(src, to, { overwrite });
        occupiedPaths.add(to);
      }
      setClipboard(null);
      mutations.refresh();
    } catch (e: any) {
      toast.error(e?.message ?? 'Paste failed');
    } finally {
      setPasting(false);
    }
  }, [askConflict, clipboard, existingPaths, pasting, prefix, mutations]);

  return {
    clipboard,
    conflict,
    pasting,
    cut,
    copy,
    paste,
    clear,
    resolveConflict,
    hasClipboard: !!clipboard?.paths.length,
  };
}

export type ExplorerClipboard = ReturnType<typeof useExplorerClipboard>;
