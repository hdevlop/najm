import React, { useMemo, useState } from 'react';
import { Check, Clock, Copy, Database, FileText, HardDrive, Link, Tag, Type } from 'lucide-react';
import { NSheet } from 'najm-kit';
import { formatBytes, formatRelativeTime } from '../../../lib/format';
import type { FileItem } from '../types';

type FilePropertiesSheetProps = {
  file: FileItem | null;
  onClose: () => void;
};

function DetailRow({
  icon: Icon,
  label,
  value,
  copyValue,
}: {
  icon: React.ComponentType<{ size?: number }>;
  label: string;
  value: React.ReactNode;
  copyValue?: string;
}) {
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    if (!copyValue) return;
    await navigator.clipboard?.writeText(copyValue).catch(() => {});
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1200);
  };

  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-white/5 bg-bg-elev-2 px-3 py-2.5 text-xs">
      <div className="flex min-w-0 items-start gap-2 text-txt-muted">
        <Icon size={14} className="mt-0.5 shrink-0" />
        <span>{label}</span>
      </div>
      <div className="flex min-w-0 items-center gap-2 text-right font-medium text-txt">
        <span className="min-w-0 break-all">{value}</span>
        {copyValue && (
          <button
            onClick={copy}
            className="shrink-0 rounded-md p-1 text-txt-muted hover:bg-white/5 hover:text-txt"
            aria-label={`Copy ${label}`}
          >
            {copied ? <Check size={13} /> : <Copy size={13} />}
          </button>
        )}
      </div>
    </div>
  );
}

export function FilePropertiesSheet({ file, onClose }: FilePropertiesSheetProps) {
  const filename = file?.filePath.split('/').pop() ?? '';
  const tags = useMemo(() => file?.tags?.filter(Boolean) ?? [], [file]);

  if (!file) return null;

  return (
    <NSheet
      open={!!file}
      onOpenChange={(open) => { if (!open) onClose(); }}
      title="Properties"
      description={filename}
      width={420}
      bodyClassName="px-5 py-5"
      contentClassName="bg-bg-elev-1"
    >
      <div className="space-y-5">
        <div>
          <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-txt-muted">
            <FileText size={12} />
            File Data
          </div>
          <div className="space-y-2">
            <DetailRow icon={FileText} label="Name" value={filename} copyValue={filename} />
            <DetailRow icon={FileText} label="Path" value={file.filePath} copyValue={file.filePath} />
            <DetailRow icon={Database} label="Bucket" value={file.namespace} copyValue={file.namespace} />
            <DetailRow icon={Type} label="MIME type" value={file.mimeType} copyValue={file.mimeType} />
            <DetailRow icon={HardDrive} label="Size" value={formatBytes(file.size)} copyValue={String(file.size)} />
            <DetailRow icon={Clock} label="Modified" value={formatRelativeTime(file.updatedAt)} copyValue={file.updatedAt} />
            {file.url && <DetailRow icon={Link} label="Serve URL" value={file.url} copyValue={file.url} />}
          </div>
        </div>

        <div>
          <div className="mb-3 flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-txt-muted">
            <Tag size={12} />
            Tags
          </div>
          {tags.length ? (
            <div className="flex flex-wrap gap-2">
              {tags.map((tag) => (
                <span key={tag} className="rounded-md border border-white/10 bg-white/5 px-2 py-1 text-xs text-txt">
                  {tag}
                </span>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-white/5 bg-bg-elev-2 px-3 py-3 text-xs text-txt-muted">
              No tags
            </div>
          )}
        </div>
      </div>
    </NSheet>
  );
}
