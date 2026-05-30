import { useState, useCallback } from 'react';

export type DragMoveRow = { key: string; isFolder: boolean };

export function useDragMove(onMoveToFolder: (src: string, dst: string) => void) {
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const dragHandlers = useCallback((row: DragMoveRow) => {
    return {
      draggable: !row.isFolder,
      onDragStart: (e: React.DragEvent) => {
        if (row.isFolder) return;
        e.stopPropagation();
        e.dataTransfer.setData('text/x-storage-path', row.key);
        e.dataTransfer.effectAllowed = 'move';
      },
      onDragEnd: () => {
        setDropTarget(null);
      },
      onDragOver: (e: React.DragEvent) => {
        if (!row.isFolder) return;
        if (!e.dataTransfer.types.includes('text/x-storage-path')) return;
        e.preventDefault();
        e.stopPropagation();
        e.dataTransfer.dropEffect = 'move';
        setDropTarget(row.key);
      },
      onDragLeave: () => {
        if (row.isFolder) setDropTarget((t) => (t === row.key ? null : t));
      },
      onDrop: (e: React.DragEvent) => {
        if (!row.isFolder) return;
        e.preventDefault();
        e.stopPropagation();
        const src = e.dataTransfer.getData('text/x-storage-path');
        setDropTarget(null);
        if (src) onMoveToFolder(src, row.key);
      },
    };
  }, [onMoveToFolder]);

  return { dropTarget, dragHandlers };
}
