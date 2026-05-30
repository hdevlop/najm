import { useEffect, useCallback } from 'react';

export interface KeyboardHandlers {
  onSearch?: () => void;
  onEscape?: () => void;
  onCommandPalette?: () => void;
}

export function useKeyboard(handlers: KeyboardHandlers) {
  const onKey = useCallback(
    (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const isInput = ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName) || target.isContentEditable;

      if (e.key === '/' && !isInput) {
        e.preventDefault();
        handlers.onSearch?.();
      }
      if (e.key === 'Escape') {
        handlers.onEscape?.();
      }
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        handlers.onCommandPalette?.();
      }
    },
    [handlers]
  );

  useEffect(() => {
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onKey]);
}
