import React from 'react';
import { ChevronRight, Home } from 'lucide-react';
import { cn } from '../../../lib/utils';

export function Breadcrumb({
  prefix,
  onNavigate,
}: {
  prefix: string;
  onNavigate: (path: string) => void;
}) {
  // Split prefix like "assets/images/" into ["assets", "images"]
  const segments = prefix.split('/').filter(Boolean);

  return (
    <nav className="flex items-center gap-1 text-xs">
      <button
        onClick={() => onNavigate('')}
        className={cn(
          'flex items-center gap-1 rounded-md px-1.5 py-0.5 font-medium transition-colors',
          segments.length === 0
            ? 'text-txt'
            : 'text-txt-muted hover:bg-white/5 hover:text-txt'
        )}
      >
        <Home size={12} />
        root
      </button>

      {segments.map((seg, i) => {
        const isLast = i === segments.length - 1;
        const target = segments.slice(0, i + 1).join('/') + '/';

        return (
          <React.Fragment key={target}>
            <ChevronRight size={12} className="text-txt-muted/50" />
            <button
              onClick={() => !isLast && onNavigate(target)}
              disabled={isLast}
              className={cn(
                'rounded-md px-1.5 py-0.5 font-medium transition-colors',
                isLast
                  ? 'cursor-default text-txt'
                  : 'text-txt-muted hover:bg-white/5 hover:text-txt'
              )}
            >
              {seg}
            </button>
          </React.Fragment>
        );
      })}
    </nav>
  );
}
