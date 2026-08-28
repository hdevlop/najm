import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const [pos, setPos] = useState({ left: x, top: y });

  // Clamp menu position into the viewport synchronously to avoid a one-frame flash
  useLayoutEffect(() => {
    if (!menuRef.current) return;
    const rect = menuRef.current.getBoundingClientRect();
    const pad = 8;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = x;
    let top = y;
    if (left + rect.width > vw - pad) left = Math.max(pad, vw - pad - rect.width);
    if (top + rect.height > vh - pad) top = Math.max(pad, vh - pad - rect.height);
    const next = { left, top };
    setPos((prev) =>
      prev.left === next.left && prev.top === next.top ? prev : next
    );
  }, [x, y]);

  useLayoutEffect(() => {
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement && !menuRef.current?.contains(activeElement)) {
      returnFocusRef.current = activeElement;
    }

    menuRef.current
      ?.querySelector<HTMLButtonElement>('[data-context-menu-item]:not(:disabled)')
      ?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      onClose();
      queueMicrotask(() => returnFocusRef.current?.focus());
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const onMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const enabledItems = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>(
        '[data-context-menu-item]:not(:disabled)',
      ) ?? [],
    );
    if (!enabledItems.length) return;

    const currentIndex = enabledItems.indexOf(document.activeElement as HTMLButtonElement);
    let nextIndex: number | null = null;

    switch (e.key) {
      case 'ArrowDown':
        nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % enabledItems.length;
        break;
      case 'ArrowUp':
        nextIndex = currentIndex < 0
          ? enabledItems.length - 1
          : (currentIndex - 1 + enabledItems.length) % enabledItems.length;
        break;
      case 'Home':
        nextIndex = 0;
        break;
      case 'End':
        nextIndex = enabledItems.length - 1;
        break;
      case 'Tab':
        onClose();
        return;
      default:
        return;
    }

    e.preventDefault();
    enabledItems[nextIndex].focus();
  };

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
        'fixed z-[10000] w-48 rounded-lg border border-border bg-popover py-1 shadow-xl text-popover-foreground',
        className,
      )}
      style={{ left: pos.left, top: pos.top }}
      onContextMenu={(e) => e.preventDefault()}
      onKeyDown={onMenuKeyDown}
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
                tabIndex={-1}
                data-context-menu-item
                disabled={item.disabled}
                onClick={() => {
                  if (hasSub) return;
                  onAction(item.id);
                  onClose();
                }}
                className={cn(
                  'flex w-full cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-40',
                  item.danger && 'text-destructive hover:text-destructive focus:text-destructive',
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
                        tabIndex={-1}
                        disabled={sub.disabled}
                        onClick={() => { onAction(sub.id); onClose(); }}
                        className={cn(
                          'flex w-full cursor-pointer items-center gap-2 px-3 py-1.5 text-xs hover:bg-accent hover:text-accent-foreground focus:bg-accent focus:text-accent-foreground focus:outline-none disabled:cursor-not-allowed disabled:opacity-40',
                          sub.danger && 'text-destructive hover:text-destructive focus:text-destructive',
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
