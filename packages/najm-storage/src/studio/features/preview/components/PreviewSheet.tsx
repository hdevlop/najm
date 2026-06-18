import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from 'najm-kit';
import { getFileColor } from '../../../lib/mime';
import { cn } from '../../../lib/utils';
import { useStudio } from '../../../providers';
import { FileThumbnail } from '../../explorer/components/FileThumbnail';
import { useAuthBlobUrl } from '../hooks/useAuthBlobUrl';
import type { FileItem } from '../types';

const TEXT_MAX_SIZE = 500 * 1024;

function buildDirectServeUrl(storageApiBase: string, file: FileItem): string {
  const encodedPath = file.filePath.split('/').map(encodeURIComponent).join('/');
  return `${storageApiBase}/${encodeURIComponent(file.namespace)}/files/serve/${encodedPath}`;
}

function buildProxyPreviewUrl(apiBase: string, file: FileItem): string {
  const qs = new URLSearchParams();
  qs.set('namespace', file.namespace);
  qs.set('path', file.filePath);
  return `${apiBase}/preview?${qs}`;
}

function useTextPreview(file: FileItem, url: string, enabled: boolean) {
  const { getAuthHeaders } = useStudio();
  const [text, setText] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setText(null);
      setError(null);
      setLoading(false);
      return;
    }
    if (file.size > TEXT_MAX_SIZE) {
      setText(null);
      setError('Preview too large');
      setLoading(false);
      return;
    }

    const controller = new AbortController();
    setLoading(true);
    setError(null);
    setText(null);

    fetch(url, { headers: getAuthHeaders(), credentials: 'same-origin', signal: controller.signal })
      .then((res) => (res.ok ? res.text() : Promise.reject(new Error(`HTTP ${res.status}`))))
      .then((value) => {
        if (controller.signal.aborted) return;
        setText(value);
        setLoading(false);
      })
      .catch((err) => {
        if (controller.signal.aborted) return;
        setError(err?.message ?? 'Failed to load preview');
        setLoading(false);
      });

    return () => controller.abort();
  }, [enabled, file, url, getAuthHeaders]);

  return { text, loading, error };
}

type PreviewSheetProps = {
  file: FileItem | null;
  files?: FileItem[];
  onClose: () => void;
  onNavigate?: (file: FileItem) => void;
};

export function PreviewSheet(props: PreviewSheetProps) {
  if (!props.file) return null;
  return <PreviewDialog {...props} file={props.file} />;
}

function PreviewDialog({
  file,
  files,
  onClose,
  onNavigate,
}: {
  file: FileItem;
  files?: FileItem[];
  onClose: () => void;
  onNavigate?: (file: FileItem) => void;
}) {
  const { apiBase, storageApiBase, getAuthHeaders } = useStudio();
  const filename = file.filePath.split('/').pop() ?? file.filePath;
  const color = getFileColor(file.mimeType);

  const isImage = /^image\//.test(file.mimeType);
  const isVideo = /^video\//.test(file.mimeType);
  const isAudio = /^audio\//.test(file.mimeType);
  const isPdf = file.mimeType === 'application/pdf';
  const isText = /^text\//.test(file.mimeType) || ['application/json', 'application/javascript', 'application/xml', 'text/xml'].includes(file.mimeType);

  const hasAuth = useMemo(() => Object.keys(getAuthHeaders()).length > 0, [getAuthHeaders]);
  const directUrl = useMemo(() => buildDirectServeUrl(storageApiBase, file), [storageApiBase, file]);
  const mediaUrl = hasAuth ? buildProxyPreviewUrl(apiBase, file) : directUrl;

  const imageUrl = useAuthBlobUrl(isImage ? mediaUrl : undefined, isImage);
  const videoUrl = useAuthBlobUrl(isVideo ? mediaUrl : undefined, isVideo);
  const audioUrl = useAuthBlobUrl(isAudio ? mediaUrl : undefined, isAudio);
  const pdfUrl = useAuthBlobUrl(isPdf ? mediaUrl : undefined, isPdf);
  const textPreview = useTextPreview(file, mediaUrl, isText);

  const currentIndex = useMemo(() => {
    if (!files) return -1;
    return files.findIndex((f) => f.filePath === file.filePath);
  }, [files, file]);
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < (files?.length ?? 0) - 1;

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'ArrowLeft' && hasPrev) {
        event.preventDefault();
        onNavigate?.(files![currentIndex - 1]);
      }
      if (event.key === 'ArrowRight' && hasNext) {
        event.preventDefault();
        onNavigate?.(files![currentIndex + 1]);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [currentIndex, files, hasNext, hasPrev, onNavigate]);

  return (
    <Dialog open={true} onOpenChange={(open) => { if (!open) onClose(); }}>
      <DialogContent className="flex h-[90vh] w-[94vw] max-w-7xl flex-col gap-0 overflow-hidden border-white/10 bg-bg-elev-1 p-0 text-txt shadow-2xl">
        <DialogHeader className="border-b border-white/10 px-5 py-4">
          <DialogTitle className="flex min-w-0 items-center gap-3 text-sm">
            <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-lg', color.replace('text-', 'bg-').replace('400', '500/10'))}>
              <FileThumbnail mimeType={file.mimeType} url={directUrl} fileName={file.filePath} size="md" namespace={file.namespace} filePath={file.filePath} />
            </span>
            <span className="min-w-0 truncate pr-8">{filename}</span>
          </DialogTitle>
          <DialogDescription className="sr-only">{file.filePath}</DialogDescription>
        </DialogHeader>

        <div className="relative min-h-0 flex-1 bg-black/35">
          <div className="flex h-full items-center justify-center overflow-auto p-5">
            {isImage && imageUrl ? (
              <img src={imageUrl} alt={filename} className="max-h-full max-w-full object-contain" />
            ) : isVideo && videoUrl ? (
              <video src={videoUrl} controls className="max-h-full max-w-full" preload="metadata" />
            ) : isAudio && audioUrl ? (
              <div className="flex w-full max-w-2xl flex-col items-center justify-center gap-5 px-6">
                <div className={cn('flex h-20 w-20 items-center justify-center rounded-2xl', color.replace('text-', 'bg-').replace('400', '500/10'))}>
                  <FileThumbnail mimeType={file.mimeType} fileName={file.filePath} size="lg" />
                </div>
                <audio src={audioUrl} controls className="w-full" preload="metadata" />
              </div>
            ) : isPdf && pdfUrl ? (
              <iframe src={hasAuth ? pdfUrl : directUrl} title={filename} className="h-full w-full border-0 bg-white" />
            ) : isText ? (
              <div className="h-full w-full overflow-auto bg-[#0d1117] p-5">
                {textPreview.loading && (
                  <div className="flex h-full items-center justify-center gap-2 text-xs text-txt-muted">
                    <span className="inline-block h-4 w-4 animate-spin rounded-full border-2 border-txt-muted border-t-transparent" />
                    Loading preview...
                  </div>
                )}
                {textPreview.error && (
                  <div className="flex h-full flex-col items-center justify-center gap-2 text-xs text-txt-muted">
                    <AlertCircle size={16} />
                    <span>{textPreview.error}</span>
                  </div>
                )}
                {textPreview.text !== null && !textPreview.loading && !textPreview.error && (
                  <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-5 text-slate-200">{textPreview.text}</pre>
                )}
              </div>
            ) : (
              <div className="flex h-full flex-col items-center justify-center gap-3">
                <div className={cn('flex h-20 w-20 items-center justify-center rounded-2xl', color.replace('text-', 'bg-').replace('400', '500/10'))}>
                  <FileThumbnail mimeType={file.mimeType} fileName={file.filePath} size="lg" />
                </div>
                <span className="text-xs text-txt-muted">Preview not available</span>
              </div>
            )}
          </div>

          {hasPrev && (
            <button
              onClick={(event) => { event.stopPropagation(); onNavigate?.(files![currentIndex - 1]); }}
              className="absolute left-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
              aria-label="Previous file"
            >
              <ChevronLeft size={22} />
            </button>
          )}
          {hasNext && (
            <button
              onClick={(event) => { event.stopPropagation(); onNavigate?.(files![currentIndex + 1]); }}
              className="absolute right-4 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-black/50 text-white transition-colors hover:bg-black/70"
              aria-label="Next file"
            >
              <ChevronRight size={22} />
            </button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
