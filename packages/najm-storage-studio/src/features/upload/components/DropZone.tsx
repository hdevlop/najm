import React, { useState, useCallback, useRef } from 'react';
import { UploadCloud } from 'lucide-react';

export function DropZone({ onDrop, children }: { onDrop: (files: FileList) => void; children: React.ReactNode }) {
  const [over, setOver] = useState(false);
  const dragDepth = useRef(0);

  const hasFilePayload = (dataTransfer: DataTransfer) =>
    Array.from(dataTransfer.types ?? []).includes('Files');

  const handleDrag = useCallback((e: React.DragEvent) => {
    if (!hasFilePayload(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();

    if (e.type === 'dragenter') dragDepth.current += 1;
    if (e.type === 'dragleave') dragDepth.current = Math.max(0, dragDepth.current - 1);

    setOver(e.type === 'dragenter' || e.type === 'dragover' || dragDepth.current > 0);
    if (e.type === 'dragleave' && dragDepth.current === 0) setOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    if (!hasFilePayload(e.dataTransfer)) return;
    e.preventDefault();
    e.stopPropagation();
    dragDepth.current = 0;
    setOver(false);
    if (e.dataTransfer.files?.length) onDrop(e.dataTransfer.files);
  }, [onDrop]);

  return (
    <div
      onDragEnter={handleDrag}
      onDragLeave={handleDrag}
      onDragOver={handleDrag}
      onDrop={handleDrop}
      className="relative h-full"
    >
      {children}
      {over && (
        <div className="absolute inset-0 z-50 flex flex-col items-center justify-center bg-brand/10 backdrop-blur-sm">
          <UploadCloud size={48} className="mb-2 text-brand" />
          <div className="text-sm font-medium text-brand">Drop files to upload</div>
        </div>
      )}
    </div>
  );
}
