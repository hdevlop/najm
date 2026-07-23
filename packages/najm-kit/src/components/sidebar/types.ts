import type { ReactNode, ComponentType, MouseEventHandler, CSSProperties } from "react";
import type { NajmResponsiveValue } from "../../theme/design-types";

export type LinkComponentType = ComponentType<{
  href: string;
  className?: string;
  children: ReactNode;
  onClick?: MouseEventHandler;
}>;

export interface NavItem {
  id: string;
  label: string;
  href?: string;
  icon?: ComponentType<{ className?: string }>;
  badge?: ReactNode;
  disabled?: boolean;
  children?: NavItem[];
  sectionLabel?: string;
  sectionIcon?: ComponentType<{ className?: string }>;
}

export interface NavItemGroup {
  sectionLabel?: string;
  sectionIcon?: ComponentType<{ className?: string }>;
  items: NavItem[];
}

export interface NAppShellClassNames {
  root?: string;
  sidebar?: string;
  sidebarItem?: string;
  sidebarHeader?: string;
  sidebarFooter?: string;
  navbar?: string;
  content?: string;
  overlay?: string;
}

export type SidebarWidth = NajmResponsiveValue<number | string>;

export interface SidebarWidths {
  expanded?: SidebarWidth;
  collapsed?: SidebarWidth;
  mobile?: SidebarWidth;
}

export interface SidebarProps {
  logo?: ReactNode;
  navItems?: NavItem[];
  activePath?: string;
  isActive?: (item: NavItem, activePath: string) => boolean;
  onNavigate?: (href: string) => void;
  linkComponent?: LinkComponentType;
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  showCollapseButton?: boolean;
  /**
   * Where the collapse toggle lives:
   * - `'footer'` — a full-width button in the footer.
   * - `'edge'` — a small floating circle on the sidebar's edge.
   * - `'rail'` — (default) an interactive strip along the right border. Hovering it
   *   shows a resize cursor + accent line; clicking or dragging the edge collapses/expands.
   */
  collapseButtonPosition?: 'footer' | 'edge' | 'rail';
  widths?: SidebarWidths;
  showSectionLabels?: boolean;
  showSectionIcons?: boolean;
  showSectionSeparators?: boolean;
  /** Use a border instead of the default flat sidebar edge. */
  bordered?: boolean;
  footer?: ReactNode;
  className?: string;
  classNames?: NAppShellClassNames;
  mobileBreakpoint?: 'sm' | 'md' | 'lg';
  /**
   * Automatically use the collapsed desktop rail within one Tailwind
   * breakpoint band. For example, `lg` collapses from 1024px through 1279px.
   */
  autoCollapseAt?: 'sm' | 'md' | 'lg' | 'xl';
  mobileOpen?: boolean;
  defaultMobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
  closeOnNavigate?: boolean;
  hamburgerLabel?: string;
  closeLabel?: string;
  collapseLabel?: string;
  expandLabel?: string;
  hamburgerClassName?: string;
  /**
   * Opts into the legacy fixed standalone trigger. Prefer controlling
   * `mobileOpen` from an NPageHeader via its `onSidebarOpen` prop.
   */
  showHamburgerButton?: boolean;
  logoIcon?: ComponentType<{ className?: string }> | ReactNode;
  logoTitle?: string;
  logoSubtitle?: string;
  onLogoClick?: () => void;
  onSettings?: () => void;
  settingsLabel?: string;
  onLogout?: () => void;
  logoutLabel?: string;
}

export interface SidebarItemProps {
  item: NavItem;
  activePath?: string;
  isActive?: (item: NavItem, activePath: string) => boolean;
  onNavigate?: (href: string) => void;
  linkComponent?: LinkComponentType;
  collapsed?: boolean;
  depth?: number;
  classNames?: NAppShellClassNames;
}

// ─── Component prop types ─────────────────────────────────────────────────────

export interface NSidebarHeaderProps {
  children?: ReactNode;
  collapsed?: boolean;
  className?: string;
  classNames?: NAppShellClassNames;
}

export interface NSidebarLogoProps {
  icon?: ComponentType<{ className?: string }> | ReactNode;
  title?: string;
  subtitle?: string;
  onClick?: () => void;
  collapsed?: boolean;
}

export interface NSidebarContentProps {
  groups: NavItemGroup[];
  activePath: string;
  isActive?: (item: NavItem, activePath: string) => boolean;
  onNavigate: (href: string) => void;
  linkComponent?: LinkComponentType;
  collapsed: boolean;
  showSectionLabels: boolean;
  showSectionIcons: boolean;
  showSectionSeparators: boolean;
  contentStyle?: CSSProperties;
  classNames?: NAppShellClassNames;
}

export interface NSidebarSectionProps {
  group: NavItemGroup;
  activePath: string;
  isActive?: (item: NavItem, activePath: string) => boolean;
  onNavigate: (href: string) => void;
  linkComponent?: LinkComponentType;
  collapsed: boolean;
  showSectionLabels: boolean;
  showSectionIcons: boolean;
  showSectionSeparators: boolean;
  isFirst: boolean;
  classNames?: NAppShellClassNames;
}

export interface NSidebarFooterProps {
  children?: ReactNode;
  onSettings?: () => void;
  settingsLabel?: string;
  onLogout?: () => void;
  logoutLabel?: string;
  showCollapseButton?: boolean;
  collapsed?: boolean;
  onToggleCollapsed?: () => void;
  collapseLabel?: string;
  expandLabel?: string;
  isMobile?: boolean;
  className?: string;
  classNames?: NAppShellClassNames;
}

export interface NSidebarMobileProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
  mobileBreakpoint: 'sm' | 'md' | 'lg';
  width?: number | string;
  hamburgerLabel?: string;
  closeLabel?: string;
  hamburgerClassName?: string;
  showHamburgerButton?: boolean;
  children?: ReactNode;
  bordered?: boolean;
}
