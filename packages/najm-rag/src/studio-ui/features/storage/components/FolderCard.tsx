import React from 'react';
import { Button, Checkbox, NFileTypeIcon, NFolderIcon, cn } from 'najm-kit';

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

/**
 * A folder or file tile. The checkbox is a sibling of the tile's button, not
 * a child: a control inside a button is invalid and steals its clicks.
 */
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
  const isFolder = variant === 'folder';

  return (
    <div
      className="group relative w-32"
      onContextMenu={onContextMenu ? (e) => {
        e.preventDefault();
        e.stopPropagation();
        onContextMenu(e);
      } : undefined}
    >
      <Button
        type="button"
        variant="ghost"
        onClick={onOpen}
        aria-pressed={selectable ? selected : undefined}
        className={cn(
          'flex h-auto min-h-[116px] w-full flex-col items-center justify-start gap-2 whitespace-normal rounded-lg border border-transparent px-3 py-3 text-center',
          selected ? 'border-primary/35 bg-primary/10 hover:bg-primary/10' : 'hover:border-border/70 hover:bg-accent/35',
        )}
      >
        {isFolder ? (
          <NFolderIcon size="lg" className="mt-0.5 drop-shadow-sm transition-transform group-hover:-translate-y-0.5" />
        ) : (
          <NFileTypeIcon mimeType="application/json" fileName={label} size="lg" className="mt-0.5 transition-transform group-hover:-translate-y-0.5" />
        )}
        <span className="block w-full">
          <span className="block truncate text-[13px] font-semibold leading-5 text-foreground">{label}</span>
          {subtitle && <span className="block truncate text-[11px] font-normal leading-4 text-txt-muted">{subtitle}</span>}
        </span>
      </Button>

      {selectable && (
        <Checkbox
          checked={selected}
          onCheckedChange={() => onToggleSelect?.()}
          aria-label={`Select ${label}`}
          className={cn(
            'absolute left-1.5 top-1.5 bg-background/80 transition-opacity',
            selected ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100',
          )}
        />
      )}
    </div>
  );
}
