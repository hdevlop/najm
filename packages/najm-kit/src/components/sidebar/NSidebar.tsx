import { useMemo, useCallback, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/cn";
import { sidebarBorderClasses } from "../../theme/borders";
import { useNajmComponentStyle } from "../../theme/design-provider";
import { NSidebarHeader } from "./NSidebarHeader";
import { NSidebarLogo } from "./NSidebarLogo";
import { NSidebarContent } from "./NSidebarContent";
import { NSidebarFooter } from "./NSidebarFooter";
import { NSidebarMobile } from "./NSidebarMobile";
import type { NavItem, NavItemGroup, SidebarProps } from "./types";

export type { SidebarProps } from "./types";

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
  collapseButtonPosition = 'rail',
  showSectionLabels,
  showSectionIcons = true,
  showSectionSeparators,
  bordered,
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
  collapseLabel = "Collapse",
  expandLabel = "Expand",
  hamburgerClassName,
  showHamburgerButton = true,
  logoIcon,
  logoTitle,
  logoSubtitle,
  onLogoClick,
  onSettings,
  settingsLabel,
  onLogout,
  logoutLabel,
  widths,
}: SidebarProps) {
  const recipe = useNajmComponentStyle("sidebar");
  const [_mobileOpen, _setMobileOpen] = useState(defaultMobileOpen);
  const [_collapsed, _setCollapsed] = useState(defaultCollapsed);
  const isControlled = mobileOpenProp !== undefined;
  const mobileOpen = isControlled ? mobileOpenProp : _mobileOpen;
  const collapsed = collapsedProp ?? _collapsed;
  const setMobileOpen = (open: boolean) => {
    if (!isControlled) _setMobileOpen(open);
    onMobileOpenChange?.(open);
  };
  const [railDragging, setRailDragging] = useState(false);
  const suppressRailClickRef = useRef(false);
  const setCollapsedState = useCallback((next: boolean) => {
    if (next === collapsed) return;
    if (collapsedProp === undefined) _setCollapsed(next);
    onCollapsedChange?.(next);
  }, [collapsed, collapsedProp, onCollapsedChange]);
  const handleToggleCollapsed = useCallback(() => {
    setCollapsedState(!collapsed);
  }, [collapsed, setCollapsedState]);

  // Drag-the-edge-to-collapse: drag left to collapse, drag right to expand.
  const handleRailPointerDown = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    const startX = e.clientX;
    const startCollapsed = collapsed;
    const threshold = 24;
    let resolved = false;
    setRailDragging(true);

    const onMove = (ev: PointerEvent) => {
      const dx = ev.clientX - startX;
      if (!resolved && !startCollapsed && dx < -threshold) {
        resolved = true;
        suppressRailClickRef.current = true;
        setCollapsedState(true);
      } else if (!resolved && startCollapsed && dx > threshold) {
        resolved = true;
        suppressRailClickRef.current = true;
        setCollapsedState(false);
      }
    };
    const onUp = (ev: PointerEvent) => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      setRailDragging(false);
      if (resolved || Math.abs(ev.clientX - startX) >= 4) suppressRailClickRef.current = true;
    };
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
  }, [collapsed, setCollapsedState]);
  const handleRailClick = useCallback(() => {
    if (suppressRailClickRef.current) {
      suppressRailClickRef.current = false;
      return;
    }
    handleToggleCollapsed();
  }, [handleToggleCollapsed]);

  const handleNavigate = useCallback((href: string) => {
    onNavigate?.(href);
    if (closeOnNavigate) setMobileOpen(false);
  }, [onNavigate, closeOnNavigate]);

  const groups = useMemo(() => buildGroups(navItems), [navItems]);

  const desktopClass = mobileBreakpoint === 'sm' ? 'hidden sm:flex'
    : mobileBreakpoint === 'lg' ? 'hidden lg:flex'
    : 'hidden md:flex';

  const expandedWidth = widths?.expanded ?? 240;
  const collapsedWidth = widths?.collapsed ?? 64;
  const mobileWidth = widths?.mobile ?? expandedWidth;
  const railVar = typeof collapsedWidth === 'number' ? `${collapsedWidth}px` : collapsedWidth;
  const sidebarEdgeWidth = bordered === false ? '0px' : recipe?.borderWidth ?? 'var(--border-width, 1px)';
  const showEdgeCollapse = showCollapseButton && collapseButtonPosition === 'edge';
  const showRailCollapse = showCollapseButton && collapseButtonPosition === 'rail';
  const effectiveShowSectionLabels = showSectionLabels ?? recipe?.showSectionLabels ?? true;
  const effectiveShowSectionSeparators = showSectionSeparators ?? recipe?.showSectionSeparators ?? false;
  const contentSlot = recipe?.slots?.content;
  const contentStyle = contentSlot?.paddingTop
    ? { paddingTop: contentSlot.paddingTop }
    : undefined;

  const defaultLogoContent = logoIcon || logoTitle || logoSubtitle
    ? <NSidebarLogo icon={logoIcon} title={logoTitle} subtitle={logoSubtitle} onClick={onLogoClick} collapsed={collapsed} />
    : null;
  const headerContent = logo ?? defaultLogoContent;

  const contentProps = {
    groups,
    activePath,
    isActive,
    onNavigate: handleNavigate,
    linkComponent,
    collapsed,
    showSectionLabels: effectiveShowSectionLabels,
    showSectionIcons,
    showSectionSeparators: effectiveShowSectionSeparators,
    contentStyle,
    classNames,
  };

  const footerProps = {
    children: footer,
    onSettings,
    settingsLabel,
    onLogout,
    logoutLabel,
    showCollapseButton: showCollapseButton && collapseButtonPosition === 'footer',
    collapsed,
    onToggleCollapsed: handleToggleCollapsed,
    collapseLabel,
    expandLabel,
    classNames,
  };

  const sidebarInner = (
    <>
      {headerContent && <NSidebarHeader collapsed={collapsed} classNames={classNames}>{headerContent}</NSidebarHeader>}
      <NSidebarContent {...contentProps} />
      <NSidebarFooter {...footerProps} />
    </>
  );

  const mobileInner = (
    <>
      {headerContent && <NSidebarHeader collapsed={collapsed} classNames={classNames}>{headerContent}</NSidebarHeader>}
      <NSidebarContent {...contentProps} />
      <NSidebarFooter {...footerProps} isMobile />
    </>
  );

  return (
    <>
      <NSidebarMobile
        open={mobileOpen}
        onOpen={() => setMobileOpen(true)}
        onClose={() => setMobileOpen(false)}
        mobileBreakpoint={mobileBreakpoint}
        width={mobileWidth}
        hamburgerLabel={hamburgerLabel}
        closeLabel={closeLabel}
        hamburgerClassName={hamburgerClassName}
        showHamburgerButton={showHamburgerButton}
        bordered={bordered}
      >
        {mobileInner}
      </NSidebarMobile>

      <aside
        data-bordered={bordered === false ? "false" : bordered ? "true" : undefined}
        className={cn(
          desktopClass,
          "relative z-10 flex flex-col h-full bg-sidebar text-sidebar-foreground transition-all duration-200",
          sidebarBorderClasses(bordered, 'right'),
          classNames?.sidebar,
          className
        )}
        style={{
          width: collapsed ? collapsedWidth : expandedWidth,
          ['--rail' as any]: railVar,
          ['--sidebar-edge-width' as any]: sidebarEdgeWidth,
          ...(bordered !== false && recipe?.borderWidth ? { borderRightWidth: recipe.borderWidth } : {}),
        }}
      >
        {sidebarInner}
        {showRailCollapse && (
          <button
            type="button"
            aria-label={collapsed ? expandLabel : collapseLabel}
            title={collapsed ? expandLabel : collapseLabel}
            data-dragging={railDragging ? "true" : undefined}
            onPointerDown={handleRailPointerDown}
            onClick={handleRailClick}
            className="group/rail absolute inset-y-0 right-0 z-20 flex w-3 translate-x-1/2 cursor-ew-resize touch-none select-none items-center justify-center border-0 bg-transparent p-0"
          >
            {/* full-height accent line, revealed on hover/drag */}
            <span className="absolute inset-y-0 right-1/2 w-0.5 translate-x-1/2 bg-sidebar-ring opacity-0 transition-opacity duration-150 group-hover/rail:opacity-100 group-data-[dragging=true]/rail:opacity-100" />
            {/* centered grip handle */}
            <span className="relative h-9 w-1 rounded-full bg-sidebar-border transition-all duration-150 group-hover/rail:h-12 group-hover/rail:bg-sidebar-ring group-data-[dragging=true]/rail:bg-sidebar-ring" />
          </button>
        )}
        {showEdgeCollapse && (
          <button
            type="button"
            onClick={handleToggleCollapsed}
            aria-label={collapsed ? expandLabel : collapseLabel}
            title={collapsed ? expandLabel : collapseLabel}
            className="absolute right-0 top-7 z-20 flex size-6 -translate-y-1/2 translate-x-1/2 cursor-pointer items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            {collapsed
              ? <ChevronRight className="h-3.5 w-3.5" />
              : <ChevronLeft className="h-3.5 w-3.5" />}
          </button>
        )}
      </aside>
    </>
  );
}
