import React from 'react';
import type { Citation } from '@/features/chat/types';
import { CitationBadge } from './CitationBadge';

interface AIMessageProps {
  content: string;
  citations?: Citation[];
  onCitationClick?: (chunkId: string, documentId: string) => void;
}

export function AIMessage({ content, citations, onCitationClick }: AIMessageProps) {
  return (
    <div className="flex flex-col gap-2">
      <div className="bg-card border border-border rounded-lg px-3 py-2 max-w-[80%] text-sm text-txt-primary leading-relaxed whitespace-pre-wrap">
        {content}
      </div>
      {citations && citations.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {citations.map((c, i) => (
            <CitationBadge
              key={i}
              citation={c}
              index={i}
              onClick={() => onCitationClick?.(c.chunkId, c.documentId)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
