import React, { useCallback, useMemo, useState } from 'react';
import type { LucideIcon } from 'lucide-react';
import { NContextMenu, type NContextMenuItem } from './NContextMenu';

/**
 * A single context menu entry. Each item carries its own `onSelect` callback,
 * so menus are co-located with their handlers — no central dispatcher needed.
 */
export interface ContextMenuItem {
  label: string;
  icon?: LucideIcon;
  danger?: boolean;
  disabled?: boolean;
  separatorBefore?: boolean;
  /** Single level of submenu items. */
  submenu?: ContextMenuItem[];
  /** Called when the user clicks this item. Ignored when `submenu` is set. */
  onSelect?: () => void;
}

export interface UseContextMenuResult {
  /**
   * Open the menu at the event's coordinates with the given items.
   * Pass the React/DOM event (or any `{ clientX, clientY }`); calling
   * `preventDefault` on it is optional but recommended for `onContextMenu`.
   */
  open: (e: { clientX: number; clientY: number; preventDefault?: () => void }, items: ContextMenuItem[]) => void;
  close: () => void;
  /** Render this once at the root of your view. */
  menu: React.ReactNode;
  /** True while the menu is visible. */
  isOpen: boolean;
}

interface MenuState {
  x: number;
  y: number;
  items: ContextMenuItem[];
}

/**
 * Generic right-click context menu hook. View-agnostic: works for table rows,
 * cards, sidebar nodes, charts, whitespace, anywhere. Each item declares its
 * own `onSelect` so menus stay co-located with the data they act on.
 *
 * @example
 * const ctx = useContextMenu();
 *
 * <Card onContextMenu={(e) => ctx.open(e, [
 *   { label: 'Edit',    icon: Pencil, onSelect: () => editCard(card.id) },
 *   { label: 'Delete',  icon: Trash2, danger: true, onSelect: () => del(card.id) },
 * ])} />
 *
 * {ctx.menu}
 */
export function useContextMenu(): UseContextMenuResult {
  const [state, setState] = useState<MenuState | null>(null);

  const open = useCallback<UseContextMenuResult['open']>((e, items) => {
    e.preventDefault?.();
    if (!items.length) return;
    setState({ x: e.clientX, y: e.clientY, items });
  }, []);

  const close = useCallback(() => setState(null), []);

  // Translate ContextMenuItem -> NContextMenuItem (id-based) for the primitive.
  // We index into a flat list so submenu callbacks resolve too.
  const { nItems, callbacks } = useMemo(() => {
    const cbs = new Map<string, () => void>();
    const toN = (item: ContextMenuItem, path: string): NContextMenuItem => {
      const id = path;
      if (item.onSelect && !item.submenu) cbs.set(id, item.onSelect);
      return {
        id,
        label: item.label,
        icon: item.icon,
        danger: item.danger,
        disabled: item.disabled,
        separatorBefore: item.separatorBefore,
        submenu: item.submenu?.map((s, j) => toN(s, `${path}.${j}`)),
      };
    };
    const items = state?.items.map((item, i) => toN(item, String(i))) ?? [];
    return { nItems: items, callbacks: cbs };
  }, [state]);

  const handleAction = useCallback((id: string) => {
    callbacks.get(id)?.();
  }, [callbacks]);

  const menu = state ? (
    <NContextMenu x={state.x} y={state.y} items={nItems} onAction={handleAction} onClose={close} />
  ) : null;

  return { open, close, menu, isOpen: state !== null };
}
