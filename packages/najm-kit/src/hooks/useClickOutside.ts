import { useEffect, useRef } from 'react';

interface UseClickOutsideOptions {
  enabled?: boolean;
  onClickOutside: () => void;
}

export function useClickOutside(
  ref: React.RefObject<HTMLElement | null>,
  options: UseClickOutsideOptions,
) {
  const { enabled = true, onClickOutside } = options;

  useEffect(() => {
    if (!enabled) return;

    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClickOutside();
      }
    };

    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [enabled, ref, onClickOutside]);
}