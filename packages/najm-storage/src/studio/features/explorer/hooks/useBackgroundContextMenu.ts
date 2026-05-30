import { useEffect, type RefObject } from 'react';

interface BackgroundOpener {
  (e: { preventDefault: () => void; clientX: number; clientY: number }): void;
}

/**
 * Attaches a `contextmenu` listener to the root element that fires
 * `onBackground(e)` when the right-click target is NOT inside a row, header,
 * dialog, or existing context menu — i.e. when it's empty/background space.
 */
export function useBackgroundContextMenu(
  rootRef: RefObject<HTMLElement>,
  onBackground: BackgroundOpener,
) {
  useEffect(() => {
    const el = rootRef.current;
    if (!el) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement | null;
      if (!target) return;
      if (target.closest('[data-row]')) return;
      if (target.closest('[data-no-ctx]')) return;
      if (target.closest('[role="dialog"]')) return;
      if (target.closest('[data-context-menu]')) return;
      onBackground({ preventDefault: () => e.preventDefault(), clientX: e.clientX, clientY: e.clientY });
    };
    el.addEventListener('contextmenu', handler);
    return () => el.removeEventListener('contextmenu', handler);
  }, [rootRef, onBackground]);
}
