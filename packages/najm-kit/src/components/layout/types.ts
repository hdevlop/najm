import type { ReactNode, ComponentType } from "react";
import type { LinkComponentType, NavItem, NAppShellClassNames, SidebarProps, SidebarWidths } from "../sidebar/types";

export type { LinkComponentType, NavItem, NAppShellClassNames, SidebarWidths };

export interface UserMenuAction {
  id: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  onClick?: () => void;
  separator?: boolean;
}

export interface NAppShellUser {
  name: string;
  email?: string;
  avatarUrl?: string;
  fallback?: string;
}

export interface NAppShellAction {
  id: string;
  label: string;
  icon?: ComponentType<{ className?: string }>;
  onClick?: () => void;
  badge?: ReactNode;
  hideOnMobile?: boolean;
}

export interface NAppShellProps extends Pick<SidebarProps, "widths"> {
  children: ReactNode;
  logo?: ReactNode;
  title?: string;
  navItems?: NavItem[];
  activePath?: string;
  onNavigate?: (href: string) => void;
  isActive?: (item: NavItem, activePath: string) => boolean;
  linkComponent?: LinkComponentType;
  user?: NAppShellUser;
  actions?: NAppShellAction[];
  userMenuActions?: UserMenuAction[];
  onLogout?: () => void;
  collapsed?: boolean;
  defaultCollapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
  /** Where the collapse toggle lives: a full-width button in the footer, or a small floating circle on the sidebar's edge. */
  collapseButtonPosition?: 'footer' | 'edge';
  sidebarFooter?: ReactNode;
  navbarLeft?: ReactNode;
  navbarRight?: ReactNode;
  classNames?: NAppShellClassNames;
}

export interface NAppCommandItem {
  id: string;
  label: string;
  description?: string;
  icon?: ComponentType<{ className?: string }>;
  shortcut?: string;
  onSelect: () => void;
  group?: string;
}

export interface NCommandPaletteProps {
  commands: NAppCommandItem[];
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
}
