import React from 'react';
import type { Citation } from '@/features/chat/types';
import { Badge } from 'najm-kit';

interface CitationBadgeProps {
  citation: Citation;
  index: number;
  onClick?: () => void;
}

export function CitationBadge({ citation, index, onClick }: CitationBadgeProps) {
  return (
    <button
      onClick={onClick}
      className="inline-flex items-center gap-1 bg-brand/20 text-brand text-sm px-2 py-0.5 rounded hover:bg-brand/30 transition-colors"
    >
      <span className="font-medium">[{index + 1}]</span>
      <span className="text-txt-muted max-w-[120px] truncate">
        {citation.sourceType}:{citation.ordinal}
      </span>
      <span className="text-brand/60">{(citation.score * 100).toFixed(0)}%</span>
    </button>
  );
}
