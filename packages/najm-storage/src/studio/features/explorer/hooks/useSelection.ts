import { useState, useCallback } from 'react';

export function useSelection() {
  const [selected, setSelected] = useState<Set<string>>(new Set());

  const toggle = useCallback((key: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const selectRange = useCallback((keys: string[], anchor: string, end: string) => {
    const startIdx = keys.indexOf(anchor);
    const endIdx = keys.indexOf(end);
    if (startIdx === -1 || endIdx === -1) return;
    const [a, b] = startIdx < endIdx ? [startIdx, endIdx] : [endIdx, startIdx];
    const range = keys.slice(a, b + 1);
    setSelected((prev) => {
      const next = new Set(prev);
      range.forEach((k) => next.add(k));
      return next;
    });
  }, []);

  const clear = useCallback(() => setSelected(new Set()), []);
  const setAll = useCallback((keys: string[]) => setSelected(new Set(keys)), []);
  const isSelected = useCallback((key: string) => selected.has(key), [selected]);

  return { selected, toggle, selectRange, clear, setAll, isSelected };
}
