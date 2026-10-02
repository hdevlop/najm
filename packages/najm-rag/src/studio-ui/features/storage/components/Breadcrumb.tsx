import React from 'react';
import { ChevronRight } from 'lucide-react';

import type { BreadcrumbSegment } from '../types';

interface BreadcrumbProps {
  segments: BreadcrumbSegment[];
}

export function Breadcrumb({ segments }: BreadcrumbProps) {
  return (
    <div className="flex items-center gap-1 text-sm">
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        const node = seg.onClick && !isLast ? (
          <button
            type="button"
            onClick={seg.onClick}
            className="rounded px-1.5 py-0.5 text-txt-muted hover:bg-accent hover:text-foreground"
          >
            {seg.label}
          </button>
        ) : (
          <span className={isLast ? 'px-1.5 py-0.5 font-medium text-foreground' : 'px-1.5 py-0.5 text-txt-muted'}>
            {seg.label}
          </span>
        );
        return (
          <React.Fragment key={`${seg.label}-${i}`}>
            {node}
            {!isLast && <ChevronRight className="h-3.5 w-3.5 text-txt-muted" />}
          </React.Fragment>
        );
      })}
    </div>
  );
}
