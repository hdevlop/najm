import { useRef, useEffect } from 'react';

export function useFormClickOutside(
  isActive: boolean,
  onClickOutside: () => void,
) {
  const formRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isActive) return;
    const onClick = (e: MouseEvent) => {
      if (formRef.current && !formRef.current.contains(e.target as Node)) {
        onClickOutside();
      }
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [isActive, onClickOutside]);

  return formRef;
}