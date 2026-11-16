import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Button } from 'najm-kit';

import type { BreadcrumbSegment } from '../types';

interface BreadcrumbProps {
  segments: BreadcrumbSegment[];
}

export function Breadcrumb({ segments }: BreadcrumbProps) {
  return (
    <nav aria-label="Breadcrumb" className="flex items-center gap-1 text-sm">
      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        const node = seg.onClick && !isLast ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={seg.onClick}
            className="h-auto px-1.5 py-0.5 font-normal text-txt-muted hover:text-foreground"
          >
            {seg.label}
          </Button>
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
    </nav>
  );
}
