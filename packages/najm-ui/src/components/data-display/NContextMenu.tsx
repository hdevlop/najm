import React, { useEffect, useRef, useState } from 'react';
import { ChevronRight, type LucideIcon } from 'lucide-react';
import { cn } from '../../lib/cn';

export interface NContextMenuItem {
  id: string;
  label: string;
  icon?: LucideIcon;
  danger?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
  submenu?: NContextMenuItem[];
}

export interface NContextMenuProps {
  x: number;
  y: number;
  items: NContextMenuItem[];
  onAction: (id: string) => void;
  onClose: () => void;
  className?: string;
}

/**
 * Right-click style context menu rendered at viewport coordinates `(x, y)`.
 * Closes on outside click, Escape, or after an action fires.
 * Supports a single level of submenus (hover the parent item).
 */
export function NContextMenu({ x, y, items, onAction, onClose, className }: NContextMenuProps) {
  const [openSub, setOpenSub] = useState<string | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    const isInsideMenu = (target: EventTarget | null) =>
      target instanceof Node && !!menuRef.current?.contains(target);

    const onMouseDown = (e: MouseEvent) => {
      if (!isInsideMenu(e.target)) onClose();
    };

    const onContextMenu = (e: MouseEvent) => {
      if (isInsideMenu(e.target)) return;
      onClose();
    };

    document.addEventListener('mousedown', onMouseDown, true);
    document.addEventListener('contextmenu', onContextMenu, true);
    return () => {
      document.removeEventListener('mousedown', onMouseDown, true);
      document.removeEventListener('contextmenu', onContextMenu, true);
    };
  }, [onClose]);

  return (
    <div
      ref={menuRef}
      role="menu"
      data-context-menu
      className={cn(
        'fixed z-50 w-48 rounded-lg border border-border bg-popover py-1 shadow-xl text-popover-foreground',
        className,
      )}
      style={{ left: x, top: y }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {items.map((item) => {
        const Icon = item.icon;
        const hasSub = !!item.submenu?.length;
        return (
          <React.Fragment key={item.id}>
            {item.separatorBefore && <div className="my-1 border-t border-border/60" />}
            <div
              className="relative"
              onMouseEnter={() => setOpenSub(hasSub ? item.id : null)}
              onMouseLeave={() => hasSub && setOpenSub(null)}
            >
              <button
                type="button"
                role="menuitem"
                disabled={item.disabled}
                onClick={() => {
                  if (hasSub) return;
                  onAction(item.id);
                  onClose();
                }}
                className={cn(
                  'flex w-full items-center justify-between gap-2 px-3 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground disabled:opacity-40 disabled:cursor-not-allowed',
                  item.danger && 'text-destructive hover:text-destructive',
                )}
              >
                <span className="flex items-center gap-2">
                  {Icon && <Icon size={14} />} {item.label}
                </span>
                {hasSub && <ChevronRight size={12} className="text-muted-foreground" />}
              </button>
              {hasSub && openSub === item.id && (
                <div className="absolute left-full top-0 ml-0.5 w-44 rounded-lg border border-border bg-popover py-1 shadow-xl">
                  {item.submenu!.map((sub) => {
                    const SubIcon = sub.icon;
                    return (
                      <button
                        key={sub.id}
                        type="button"
                        role="menuitem"
                        disabled={sub.disabled}
                        onClick={() => { onAction(sub.id); onClose(); }}
                        className={cn(
                          'flex w-full items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground disabled:opacity-40',
                          sub.danger && 'text-destructive hover:text-destructive',
                        )}
                      >
                        {SubIcon && <SubIcon size={14} />} {sub.label}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </React.Fragment>
        );
      })}
    </div>
  );
}
