import React, { useState, useCallback } from 'react';
import {
  Download,
  Share2,
  Copy,
  ExternalLink,
  Type,
  HardDrive,
  Clock,
  Database,
  Tag,
  Zap,
} from 'lucide-react';
import { NSheet } from 'najm-ui';
import { formatBytes, formatRelativeTime } from '../../../lib/format';
import { getFileColor } from '../../../lib/mime';
import { cn } from '../../../lib/utils';
import { PresignModal } from '../../presign/components/PresignModal';
import { FileThumbnail } from '../../explorer/components/FileThumbnail';
import type { FileItem } from '../types';

export function PreviewSheet({
  file,
  onClose,
}: {
  file: FileItem | null;
  onClose: () => void;
}) {
  const [shareOpen, setShareOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [transformQuality, setTransformQuality] = useState('85');

  const handleCopyUrl = useCallback(() => {
    if (!file?.url) return;
    const fullUrl = file.url.startsWith('http') ? file.url : `${window.location.origin}${file.url}`;
    navigator.clipboard.writeText(fullUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [file]);

  const handleDownload = useCallback(() => {
    if (!file?.url) return;
    const a = document.createElement('a');
    a.href = file.url;
    a.download = file.filePath.split('/').pop() ?? 'download';
    a.click();
  }, [file]);

  const handleOpen = useCallback(() => {
    if (!file?.url) return;
    window.open(file.url, '_blank');
  }, [file]);

  if (!file) return null;

  const filename = file.filePath.split('/').pop() ?? file.filePath;
  const isImage = /^image\//.test(file.mimeType);
  const isVideo = /^video\//.test(file.mimeType);
  const color = getFileColor(file.mimeType);

  const actions = [
    { label: 'Download', icon: Download, onClick: handleDownload },
    { label: 'Share', icon: Share2, onClick: () => setShareOpen(true) },
    { label: copied ? 'Copied!' : 'Copy URL', icon: Copy, onClick: handleCopyUrl },
    { label: 'Open', icon: ExternalLink, onClick: handleOpen },
  ];

  const detailRows = [
    { icon: Type, label: 'Type', value: file.mimeType },
    { icon: HardDrive, label: 'Size', value: formatBytes(file.size) },
    { icon: Clock, label: 'Modified', value: formatRelativeTime(file.updatedAt) },
    { icon: Database, label: 'Bucket', value: file.namespace },
  ];

  return (
    <>
      <NSheet
        open={!!file}
        onOpenChange={(open) => { if (!open) onClose(); }}
        title={
          <span className="flex min-w-0 items-center gap-3">
            <span className={cn('flex h-8 w-8 shrink-0 items-center justify-center rounded-lg', color.replace('text-', 'bg-').replace('400', '500/10'))}>
              <FileThumbnail mimeType={file.mimeType} url={file.url} fileName={file.filePath} size="md" />
            </span>
            <span className="min-w-0">
              <span className="block truncate">{filename}</span>
            </span>
          </span>
        }
        description={file.filePath}
        width={448}
        bodyClassName="px-0 py-0"
        contentClassName="bg-bg-elev-1"
      >
          {/* Preview area */}
          <div className="px-5 pt-5">
            <div className="flex items-center justify-center overflow-hidden rounded-xl bg-bg-elev-2">
              {isImage && file.url ? (
                <img
                  src={file.url}
                  alt={filename}
                  className="max-h-64 w-full object-contain"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = 'none';
                  }}
                />
              ) : isVideo && file.url ? (
                <video
                  src={file.url}
                  controls
                  className="max-h-64 w-full"
                  preload="metadata"
                />
              ) : (
                <div className="flex h-48 w-full flex-col items-center justify-center gap-3">
                  <div className={cn('flex h-16 w-16 items-center justify-center rounded-2xl', color.replace('text-', 'bg-').replace('400', '500/10'))}>
                    <FileThumbnail mimeType={file.mimeType} fileName={file.filePath} size="lg" />
                  </div>
                  <span className="text-xs text-txt-muted">Preview not available</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="grid grid-cols-4 gap-2 px-5 pt-4">
            {actions.map((a) => (
              <button
                key={a.label}
                onClick={a.onClick}
                className="flex flex-col items-center gap-1.5 rounded-lg border border-white/5 bg-bg-elev-2 py-3 text-[10px] font-medium text-txt-muted transition-colors hover:border-white/10 hover:text-txt"
              >
                <a.icon size={16} />
                {a.label}
              </button>
            ))}
          </div>

          {/* File Details */}
          <div className="px-5 pt-6">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-txt-muted">
              <Tag size={12} />
              File Details
            </div>
            <div className="space-y-3 rounded-xl border border-white/5 bg-bg-elev-2 p-4">
              {detailRows.map((row) => (
                <div key={row.label} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2 text-txt-muted">
                    <row.icon size={13} />
                    {row.label}
                  </div>
                  <span className="font-medium text-txt">{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Image Transforms (stub) */}
          {isImage && (
            <div className="px-5 pt-6 pb-6">
              <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-txt-muted">
                <Zap size={12} />
                Image Transforms
              </div>
              <div className="space-y-3 rounded-xl border border-white/5 bg-bg-elev-2 p-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs text-txt-muted">Width</span>
                  <input
                    type="text"
                    defaultValue="auto"
                    className="w-24 rounded-lg border border-white/10 bg-bg px-2 py-1 text-right text-xs text-txt outline-none focus:border-brand/50"
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs text-txt-muted">Height</span>
                  <input
                    type="text"
                    defaultValue="auto"
                    className="w-24 rounded-lg border border-white/10 bg-bg px-2 py-1 text-right text-xs text-txt outline-none focus:border-brand/50"
                  />
                </div>
                <div className="flex items-center justify-between gap-4">
                  <span className="text-xs text-txt-muted">Quality</span>
                  <input
                    type="text"
                    value={transformQuality}
                    onChange={(e) => setTransformQuality(e.target.value)}
                    className="w-24 rounded-lg border border-white/10 bg-bg px-2 py-1 text-right text-xs text-txt outline-none focus:border-brand/50"
                  />
                </div>
                <button className="mt-1 flex w-full items-center justify-center gap-2 rounded-lg bg-white/5 py-2 text-xs font-medium text-txt hover:bg-white/10">
                  <Zap size={13} />
                  Generate Transform URL
                </button>
              </div>
            </div>
          )}
      </NSheet>

      {shareOpen && (
        <PresignModal
          file={{ namespace: file.namespace, filePath: file.filePath }}
          onClose={() => setShareOpen(false)}
        />
      )}
    </>
  );
}
