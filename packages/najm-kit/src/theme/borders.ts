export type NajmBorderSide = 'all' | 'top' | 'right' | 'bottom' | 'left' | 'start' | 'end';

const SURFACE_BORDER_CLASSES: Record<NajmBorderSide, string> = {
  all: 'najm-border border-border',
  top: 'najm-border-t border-border',
  right: 'najm-border-r border-border',
  bottom: 'najm-border-b border-border',
  left: 'najm-border-l border-border',
  start: 'najm-border-s border-border',
  end: 'najm-border-e border-border',
};

const SIDEBAR_BORDER_CLASSES: Record<NajmBorderSide, string> = {
  all: 'najm-border border-sidebar-border',
  top: 'najm-border-t border-sidebar-border',
  right: 'najm-border-r border-sidebar-border',
  bottom: 'najm-border-b border-sidebar-border',
  left: 'najm-border-l border-sidebar-border',
  start: 'najm-border-s border-sidebar-border',
  end: 'najm-border-e border-sidebar-border',
};

const BORDER_RESET_CLASSES: Record<NajmBorderSide, string> = {
  all: 'border-0',
  top: 'border-t-0',
  right: 'border-r-0',
  bottom: 'border-b-0',
  left: 'border-l-0',
  start: 'border-s-0',
  end: 'border-e-0',
};

/**
 * Border utility for structural surfaces (cards, tables, dividers, side rails).
 * `bordered === false` returns a per-side reset so primitives that already
 * include a base Tailwind `border`/`border-r`/etc. still drop the border.
 */
export function surfaceBorderClasses(
  bordered: boolean | undefined = true,
  side: NajmBorderSide = 'all',
): string {
  return bordered === false ? BORDER_RESET_CLASSES[side] : SURFACE_BORDER_CLASSES[side];
}

/**
 * Border utility for sidebar surfaces. Uses the dedicated `sidebar-border`
 * token so the sidebar edge can be themed independently from the main
 * `border` token.
 */
export function sidebarBorderClasses(
  bordered: boolean | undefined = true,
  side: NajmBorderSide = 'all',
): string {
  return bordered === false ? BORDER_RESET_CLASSES[side] : SIDEBAR_BORDER_CLASSES[side];
}

/** Border utility for form fields (inputs, selects). */
export function inputBorderClasses(bordered: boolean | undefined = true): string {
  return bordered === false ? 'border-0' : 'najm-border border-input';
}
