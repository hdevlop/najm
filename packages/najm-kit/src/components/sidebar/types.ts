import type { ReactNode, ComponentType, MouseEventHandler } from "react";

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

export interface SidebarWidths {
  expanded?: number | string;
  collapsed?: number | string;
  mobile?: number | string;
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
  /** Where the collapse toggle lives: a full-width button in the footer, or a small floating circle on the sidebar's edge. */
  collapseButtonPosition?: 'footer' | 'edge';
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
  mobileOpen?: boolean;
  defaultMobileOpen?: boolean;
  onMobileOpenChange?: (open: boolean) => void;
  closeOnNavigate?: boolean;
  hamburgerLabel?: string;
  closeLabel?: string;
  collapseLabel?: string;
  expandLabel?: string;
  hamburgerClassName?: string;
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
