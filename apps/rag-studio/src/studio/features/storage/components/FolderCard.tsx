import React, { useState } from 'react';
import { NFileTypeIcon, NFolderIcon } from 'najm-kit';

interface FolderCardProps {
  label: string;
  subtitle?: string;
  variant?: 'folder' | 'file';
  onOpen: () => void;
  /** If true, the card shows a controlled checkbox driven by `selected` + `onToggleSelect`. */
  selectable?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  /** Fires on right-click; if provided, the browser context menu is suppressed. */
  onContextMenu?: (e: React.MouseEvent) => void;
}

export function FolderCard({
  label,
  subtitle,
  variant = 'folder',
  onOpen,
  selectable = false,
  selected = false,
  onToggleSelect,
  onContextMenu,
}: FolderCardProps) {
  const [hovered, setHovered] = useState(false);

  const isFolder = variant === 'folder';

  return (
    <button
      type="button"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onDoubleClick={onOpen}
      onClick={onOpen}
      onContextMenu={onContextMenu ? (e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(e);
      } : undefined}
      className={`group relative flex w-32 min-h-[116px] flex-col items-center justify-start gap-2 rounded-lg border border-transparent px-3 py-3 text-center transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
        selected ? 'border-primary/35 bg-primary/10' : 'hover:border-border/70 hover:bg-accent/35'
      }`}
    >
      {selectable && (
        <span
          role="checkbox"
          aria-checked={selected}
          tabIndex={-1}
          onClick={(e) => {
            e.stopPropagation();
            onToggleSelect?.();
          }}
          className={`absolute left-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-sm border border-border bg-background/80 transition ${
            hovered || selected ? 'opacity-100' : 'opacity-0'
          } ${selected ? 'border-primary bg-primary text-primary-foreground' : ''}`}
        >
          {selected && (
            <svg viewBox="0 0 12 12" className="h-3 w-3" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M2 6l2.5 2.5L10 3" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
      )}

      {isFolder ? (
        <NFolderIcon size="lg" className="mt-0.5 drop-shadow-sm transition-transform group-hover:-translate-y-0.5" />
      ) : (
        <NFileTypeIcon mimeType="application/json" fileName={label} size="lg" className="mt-0.5 transition-transform group-hover:-translate-y-0.5" />
      )}

      <div className="w-full">
        <div className="truncate text-[13px] font-semibold leading-5 text-foreground">{label}</div>
        {subtitle && <div className="truncate text-[11px] leading-4 text-txt-muted">{subtitle}</div>}
      </div>
    </button>
  );
}
