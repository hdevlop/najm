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

export interface NAppShellProps {
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
