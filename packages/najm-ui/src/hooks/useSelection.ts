import { useState, useCallback } from 'react';

export function useSelection(visibleIds: string[]) {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const toggleRow = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const toggleAllVisible = useCallback(() => {
    setSelectedIds((prev) => {
      if (prev.size === visibleIds.length) {
        return new Set();
      }
      return new Set(visibleIds);
    });
  }, [visibleIds]);

  const clearSelection = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const allVisibleSelected = visibleIds.length > 0 && selectedIds.size === visibleIds.length;
  const someVisibleSelected = selectedIds.size > 0;

  return { selectedIds, toggleRow, toggleAllVisible, clearSelection, allVisibleSelected, someVisibleSelected };
}