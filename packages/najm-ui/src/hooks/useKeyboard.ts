import { useEffect, useCallback } from 'react';

interface KeyboardOptions {
  enabled?: boolean;
  preventDefault?: boolean;
  ignoreInputs?: boolean;
}

function parseShortcut(shortcut: string) {
  const parts = shortcut.toLowerCase().split('+').map((s) => s.trim());
  return {
    ctrl: parts.includes('ctrl'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt'),
    meta: parts.includes('cmd') || parts.includes('meta'),
    key: parts.find((p) => !['ctrl', 'shift', 'alt', 'cmd', 'meta'].includes(p)) || '',
  };
}

export function useKeyboard(
  shortcut: string,
  handler: (e: KeyboardEvent) => void,
  options: KeyboardOptions = {}
) {
  const { enabled = true, preventDefault = false, ignoreInputs = true } = options;

  const callback = useCallback(
    (e: KeyboardEvent) => {
      if (!enabled) return;

      if (ignoreInputs) {
        const target = e.target as HTMLElement;
        if (
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable
        ) {
          return;
        }
      }

      const parsed = parseShortcut(shortcut);

      const ctrlMatch = parsed.ctrl ? (e.ctrlKey || e.metaKey) : true;
      const shiftMatch = parsed.shift ? e.shiftKey : true;
      const altMatch = parsed.alt ? e.altKey : true;
      const metaMatch = parsed.meta ? e.metaKey : true;

      const keyMatch = parsed.key
        ? e.key.toLowerCase() === parsed.key
        : true;

      if (ctrlMatch && shiftMatch && altMatch && metaMatch && keyMatch) {
        if (preventDefault) e.preventDefault();
        handler(e);
      }
    },
    [shortcut, handler, enabled, preventDefault, ignoreInputs]
  );

  useEffect(() => {
    document.addEventListener('keydown', callback);
    return () => document.removeEventListener('keydown', callback);
  }, [callback]);
}
