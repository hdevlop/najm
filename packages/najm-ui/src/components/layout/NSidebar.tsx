import React, { useMemo, useCallback, useState } from "react";
import type { ReactNode, ComponentType } from "react";
import { cn } from "../../lib/cn";
import { NSidebarItem } from "./NSidebarItem";
import { Menu, X, Settings, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { NavItem, NAppShellClassNames, LinkComponentType } from "./types";

interface NavItemGroup {
  sectionLabel?: string;
  sectionIcon?: ComponentType<{ className?: string }>;
  items: NavItem[];
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
  showSectionLabels?: boolean;
  showSectionIcons?: boolean;
  showSectionSeparators?: boolean;
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
  logoIcon?: ComponentType<{ className?: string }> | ReactNode;
  logoTitle?: string;
  logoSubtitle?: string;
  onLogoClick?: () => void;
  onSettings?: () => void;
  settingsLabel?: string;
  onLogout?: () => void;
  logoutLabel?: string;
}

function buildGroups(items: NavItem[]): NavItemGroup[] {
  const groups: NavItemGroup[] = [];
  for (const item of items) {
    const prev = groups[groups.length - 1];
    if (!item.sectionLabel && prev) {
      prev.items.push(item);
    } else if (prev && prev.sectionLabel === item.sectionLabel) {
      prev.items.push(item);
    } else {
      groups.push({ sectionLabel: item.sectionLabel, sectionIcon: item.sectionIcon, items: [item] });
    }
  }
  return groups;
}

function DefaultLogo({
  icon,
  title,
  subtitle,
  onClick,
}: {
  icon?: ComponentType<{ className?: string }> | ReactNode;
  title?: string;
  subtitle?: string;
  onClick?: () => void;
}) {
  if (!icon && !title && !subtitle) return null;
  const IconNode =
    typeof icon === 'function' || (typeof icon === 'object' && icon !== null && '$$typeof' in icon)
      ? React.createElement(icon as ComponentType<{ className?: string }>, { className: 'h-5 w-5 text-primary' })
      : icon;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 min-w-0 text-left",
        onClick && "cursor-pointer hover:opacity-80 transition-opacity"
      )}
    >
      {IconNode && (
        <div className="size-9 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
          {IconNode}
        </div>
      )}
      {(title || subtitle) && (
        <div className="flex flex-col min-w-0">
          {title && <span className="text-sm font-semibold text-foreground leading-tight truncate">{title}</span>}
          {subtitle && <span className="text-xs text-muted-foreground leading-tight truncate">{subtitle}</span>}
        </div>
      )}
    </button>
  );
}

function DefaultFooter({
  onSettings,
  settingsLabel = 'Settings',
  onLogout,
  logoutLabel = 'Logout',
}: {
  onSettings?: () => void;
  settingsLabel?: string;
  onLogout?: () => void;
  logoutLabel?: string;
}) {
  if (!onSettings && !onLogout) return null;
  const itemClass =
    'flex items-center gap-3 w-full h-9 px-3 rounded-md text-sm font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors text-left';
  return (
    <div className="flex flex-col gap-0.5">
      {onSettings && (
        <button type="button" onClick={onSettings} className={itemClass}>
          <Settings className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate">{settingsLabel}</span>
        </button>
      )}
      {onLogout && (
        <button type="button" onClick={onLogout} className={itemClass}>
          <LogOut className="h-4 w-4 shrink-0" />
          <span className="flex-1 truncate">{logoutLabel}</span>
        </button>
      )}
    </div>
  );
}

function SidebarBody({
  headerContent,
  groups,
  activePath,
  isActive,
  handleNavigate,
  linkComponent,
  collapsed,
  showSectionLabels,
  showSectionIcons,
  showSectionSeparators,
  footerContent,
  classNames,
  className,
  onToggleCollapsed,
  showCollapseButton,
  collapseLabel,
  expandLabel,
}: {
  headerContent?: ReactNode;
  groups: NavItemGroup[];
  activePath: string;
  isActive?: (item: NavItem, activePath: string) => boolean;
  handleNavigate: (href: string) => void;
  linkComponent?: LinkComponentType;
  collapsed: boolean;
  showSectionLabels: boolean;
  showSectionIcons: boolean;
  showSectionSeparators: boolean;
  footerContent?: ReactNode;
  classNames?: NAppShellClassNames;
  className?: string;
  onToggleCollapsed?: () => void;
  showCollapseButton: boolean;
  collapseLabel: string;
  expandLabel: string;
}) {
  const CollapseIcon = collapsed ? PanelLeftOpen : PanelLeftClose;
  const shouldRenderHeader = Boolean(headerContent) || showCollapseButton;

  return (
    <>
      {shouldRenderHeader && (
        <div className={cn("flex items-center h-14 min-h-14 px-4 border-b border-border/70 shrink-0", collapsed ? "justify-center px-2" : "justify-between gap-2", classNames?.sidebarHeader)}>
          {headerContent && (
            <div className={cn("min-w-0", collapsed && "hidden")}>
              {headerContent}
            </div>
          )}
          {showCollapseButton && (
            <button
              type="button"
              onClick={onToggleCollapsed}
              className="hidden md:inline-flex size-8 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground"
              aria-label={collapsed ? expandLabel : collapseLabel}
              title={collapsed ? expandLabel : collapseLabel}
            >
              <CollapseIcon className="h-4 w-4" />
            </button>
          )}
        </div>
      )}
      <nav className="flex-1 overflow-y-auto p-1.5">
        {groups.map((group, gi) => (
          <div key={gi} data-sidebar-section className={cn("mb-3", showSectionSeparators && gi > 0 && "border-t border-border/70 pt-3")}>
            {showSectionLabels && group.sectionLabel && (
              <div className={cn("flex items-center gap-2 px-2 pb-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground", collapsed && "justify-center px-0")}>
                {showSectionIcons && group.sectionIcon && !collapsed && <group.sectionIcon className="h-3.5 w-3.5 shrink-0" />}
                {!collapsed && <span>{group.sectionLabel}</span>}
              </div>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NSidebarItem key={item.id} item={item} activePath={activePath} isActive={isActive} onNavigate={handleNavigate} linkComponent={linkComponent} collapsed={collapsed} classNames={classNames} />
              ))}
            </div>
          </div>
        ))}
      </nav>
      {footerContent && <div className={cn("border-t border-border/70 p-2 shrink-0", classNames?.sidebarFooter)}>{footerContent}</div>}
    </>
  );
}

export function NSidebar({
  logo,
  navItems = [],
  activePath = "",
  isActive,
  onNavigate,
  linkComponent,
  collapsed: collapsedProp,
  defaultCollapsed = false,
  onCollapsedChange,
  showCollapseButton = true,
  showSectionLabels = true,
  showSectionIcons = true,
  showSectionSeparators = false,
  footer,
  className,
  classNames,
  mobileBreakpoint = 'md',
  mobileOpen: mobileOpenProp,
  defaultMobileOpen = false,
  onMobileOpenChange,
  closeOnNavigate = true,
  hamburgerLabel = "Open sidebar",
  closeLabel = "Close sidebar",
  collapseLabel = "Collapse sidebar",
  expandLabel = "Expand sidebar",
  hamburgerClassName,
  logoIcon,
  logoTitle,
  logoSubtitle,
  onLogoClick,
  onSettings,
  settingsLabel,
  onLogout,
  logoutLabel,
}: SidebarProps) {
  const [_mobileOpen, _setMobileOpen] = useState(defaultMobileOpen);
  const [_collapsed, _setCollapsed] = useState(defaultCollapsed);
  const isControlled = mobileOpenProp !== undefined;
  const mobileOpen = isControlled ? mobileOpenProp : _mobileOpen;
  const collapsed = collapsedProp ?? _collapsed;
  const setMobileOpen = (open: boolean) => {
    if (!isControlled) _setMobileOpen(open);
    onMobileOpenChange?.(open);
  };
  const handleToggleCollapsed = useCallback(() => {
    const next = !collapsed;
    if (collapsedProp === undefined) _setCollapsed(next);
    onCollapsedChange?.(next);
  }, [collapsed, collapsedProp, onCollapsedChange]);

  const handleNavigate = useCallback((href: string) => {
    onNavigate?.(href);
    if (closeOnNavigate) setMobileOpen(false);
  }, [onNavigate, closeOnNavigate]);

  const groups = useMemo(() => buildGroups(navItems), [navItems]);

  const desktopClass = mobileBreakpoint === 'sm' ? 'hidden sm:flex'
    : mobileBreakpoint === 'lg' ? 'hidden lg:flex'
    : 'hidden md:flex';
  const mobileClass = mobileBreakpoint === 'sm' ? 'sm:hidden'
    : mobileBreakpoint === 'lg' ? 'lg:hidden'
    : 'md:hidden';

  const headerContent = logo ?? <DefaultLogo icon={logoIcon} title={logoTitle} subtitle={logoSubtitle} onClick={onLogoClick} />;
  const footerContent = footer ?? <DefaultFooter onSettings={onSettings} settingsLabel={settingsLabel} onLogout={onLogout} logoutLabel={logoutLabel} />;

  const sidebarBodyProps = {
    headerContent,
    groups,
    activePath,
    isActive,
    handleNavigate,
    linkComponent,
    collapsed,
    showSectionLabels,
    showSectionIcons,
    showSectionSeparators,
    footerContent,
    classNames,
    className,
    onToggleCollapsed: handleToggleCollapsed,
    showCollapseButton,
    collapseLabel,
    expandLabel,
  };

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className={cn(
          "fixed top-3 left-3 z-50 p-2 rounded-lg bg-card border shadow-md text-muted-foreground hover:text-foreground hover:bg-accent transition-colors",
          mobileClass,
          hamburgerClassName,
          mobileOpen && "hidden"
        )}
        aria-label={hamburgerLabel}
      >
        <Menu className="h-5 w-5" />
      </button>

      <aside className={cn(desktopClass, "flex flex-col h-full bg-card transition-all duration-200", collapsed ? "w-16" : "w-60", classNames?.sidebar, className)}>
        <SidebarBody {...sidebarBodyProps} />
      </aside>

      {mobileOpen && (
        <div
          className={cn("fixed inset-0 z-40 bg-black/50", mobileClass)}
          onClick={() => setMobileOpen(false)}
          aria-hidden
        />
      )}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-60 bg-card border-r flex flex-col transition-transform duration-200",
          mobileClass,
          mobileOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <button
          type="button"
          onClick={() => setMobileOpen(false)}
          className="absolute top-3 right-3 z-10 p-1 rounded-md hover:bg-accent text-muted-foreground"
          aria-label={closeLabel}
        >
          <X className="h-4 w-4" />
        </button>
        <SidebarBody {...sidebarBodyProps} />
      </aside>
    </>
  );
}
