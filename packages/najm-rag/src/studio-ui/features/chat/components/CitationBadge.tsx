import React from 'react';
import type { Citation } from '@/features/chat/types';
import { Button } from 'najm-kit';

interface CitationBadgeProps {
  citation: Citation;
  index: number;
  onClick?: () => void;
}

export function CitationBadge({ citation, index, onClick }: CitationBadgeProps) {
  return (
    <Button
      type="button"
      variant="secondary"
      size="sm"
      onClick={onClick}
      className="h-7 gap-1 px-2 text-brand"
    >
      <span className="font-medium">[{index + 1}]</span>
      <span className="text-txt-muted max-w-[120px] truncate">
        {citation.sourceType}:{citation.ordinal}
      </span>
      <span className="text-txt-secondary">{(citation.score * 100).toFixed(0)}%</span>
    </Button>
  );
}
