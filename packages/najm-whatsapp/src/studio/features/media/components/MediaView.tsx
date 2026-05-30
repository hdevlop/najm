import React from 'react';
import { Image, FileText, Film, Music } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MediaMessage {
  id: string;
  type: 'image' | 'video' | 'audio' | 'document' | 'text';
  url?: string;
  caption?: string;
  filename?: string;
}

interface MediaViewProps {
  message?: MediaMessage | null;
}

export function MediaView({ message }: MediaViewProps) {
  if (!message) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-txt-muted">
        Select a message with media.
      </div>
    );
  }

  const { type, url, caption, filename } = message;

  if (type === 'image' && url) {
    return (
      <div className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold text-txt-primary">Media</h2>
        <div className="rounded-lg border border-border bg-card p-4">
          <img
            src={url}
            alt={caption || 'Image'}
            className="max-h-[60vh] max-w-full rounded-md object-contain"
          />
          {caption && <p className="mt-2 text-xs text-txt-secondary">{caption}</p>}
        </div>
      </div>
    );
  }

  const iconMap = {
    video: Film,
    audio: Music,
    document: FileText,
    text: FileText,
    image: Image,
  };

  const Icon = iconMap[type] || FileText;

  return (
    <div className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold text-txt-primary">Media</h2>
      <div className="flex flex-col items-center gap-3 rounded-lg border border-border bg-card p-8">
        <Icon size={32} className="text-txt-muted" />
        <span className="text-sm font-medium text-txt-primary">{filename || caption || type}</span>
        {url && (
          <a
            href={url}
            target="_blank"
            rel="noreferrer"
            className="text-xs text-brand hover:underline"
          >
            Download
          </a>
        )}
      </div>
    </div>
  );
}
