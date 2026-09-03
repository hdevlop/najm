import { isValidElement, useMemo, useCallback, useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "../../lib/cn";
import { sidebarBorderClasses } from "../../theme/borders";
import { useNajmComponentStyle } from "../../theme/design-provider";
import { NSidebarHeader } from "./NSidebarHeader";
import { NSidebarBrand } from "./NSidebarBrand";
import { useNBranding } from "../branding/NBrandingContext";
import { NSidebarContent } from "./NSidebarContent";
import { NSidebarFooter } from "./NSidebarFooter";
import { NSidebarMobile } from "./NSidebarMobile";
import { useNSidebar } from "./NSidebarContext";
import type { NavItem, NavItemGroup, SidebarLogo, SidebarProps, SidebarWidth } from "./types";

export type { SidebarProps } from "./types";

const LOGO_OBJECT_KEYS = ["expanded", "collapsed", "fallback", "alt", "href", "title", "subtitle"] as const;

function isSidebarLogoObject(value: SidebarProps["logo"]): value is SidebarLogo {
  return (
    typeof value === "object" &&
    value !== null &&
    !isValidElement(value) &&
    !Array.isArray(value) &&
    LOGO_OBJECT_KEYS.some((key) => key in value)
  );
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

const autoCollapseQueries = {
  sm: '(min-width: 640px) and (max-width: 767.98px)',
  md: '(min-width: 768px) and (max-width: 1023.98px)',
  lg: '(min-width: 1024px) and (max-width: 1279.98px)',
  xl: '(min-width: 1280px) and (max-width: 1535.98px)',
} as const;

const responsiveBreakpointQueries = {
  sm: "(min-width: 640px)",
  md: "(min-width: 768px)",
  lg: "(min-width: 1024px)",
  xl: "(min-width: 1280px)",
  "2xl": "(min-width: 1536px)",
} as const;

type SidebarResponsiveBreakpoint = "base" | keyof typeof responsiveBreakpointQueries;

function useSidebarResponsiveBreakpoint(): SidebarResponsiveBreakpoint {
  const [breakpoint, setBreakpoint] = useState<SidebarResponsiveBreakpoint>("base");

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mediaQueries = Object.entries(responsiveBreakpointQueries).map(([name, query]) => ({
      name: name as Exclude<SidebarResponsiveBreakpoint, "base">,
      mediaQuery: window.matchMedia(query),
    }));
    const update = () => {
      const active = [...mediaQueries].reverse().find(({ mediaQuery }) => mediaQuery.matches);
      setBreakpoint(active?.name ?? "base");
    };
    update();
    mediaQueries.forEach(({ mediaQuery }) => mediaQuery.addEventListener?.("change", update));
    return () => mediaQueries.forEach(({ mediaQuery }) => mediaQuery.removeEventListener?.("change", update));
  }, []);

  return breakpoint;
}

function resolveSidebarWidth(
  value: SidebarWidth | undefined,
  breakpoint: SidebarResponsiveBreakpoint,
  fallback: number | string,
): number | string {
  if (value === undefined) return fallback;
  if (typeof value === "number" || typeof value === "string") return value;

  const breakpoints: SidebarResponsiveBreakpoint[] = ["base", "sm", "md", "lg", "xl", "2xl"];
  const activeIndex = breakpoints.indexOf(breakpoint);
  for (let index = activeIndex; index >= 0; index -= 1) {
    const width = value[breakpoints[index]];
    if (width !== undefined) return width;
  }
  return fallback;
}

function useAutoCollapsed(breakpoint: keyof typeof autoCollapseQueries | undefined) {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    if (!breakpoint || typeof window === 'undefined') {
      setMatches(false);
      return;
    }

    const mediaQuery = window.matchMedia(autoCollapseQueries[breakpoint]);
    const update = () => setMatches(mediaQuery.matches);
    update();
    mediaQuery.addEventListener?.('change', update);
    return () => mediaQuery.removeEventListener?.('change', update);
  }, [breakpoint]);

  return matches;
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
  mobileBreakpoint: mobileBreakpointProp,
  autoCollapseAt,
  mobileOpen: mobileOpenProp,
  defaultMobileOpen = false,
  onMobileOpenChange,
  closeOnNavigate = true,
  hamburgerLabel = "Open sidebar",
  closeLabel = "Close sidebar",
  collapseLabel = "Collapse",
  expandLabel = "Expand",
  hamburgerClassName,
  showHamburgerButton = false,
  onSettings,
  settingsLabel,
  onLogout,
  logoutLabel,
  widths,
}: SidebarProps) {
  const recipe = useNajmComponentStyle("sidebar");
  const [_mobileOpen, _setMobileOpen] = useState(defaultMobileOpen);
  const [_collapsed, _setCollapsed] = useState(defaultCollapsed);

  /**
   * State precedence is explicit prop → surrounding `NSidebarProvider` →
   * internal state. Props keep winning so every existing controlled consumer
   * behaves exactly as before, and the internal fallback keeps the standalone
   * sidebar working with no provider at all.
   */
  const sidebar = useNSidebar();
  const branding = useNBranding();
  const isMobileControlled = mobileOpenProp !== undefined;
  const isCollapsedControlled = collapsedProp !== undefined;
  const mobileOpen = isMobileControlled
    ? mobileOpenProp
    : sidebar?.mobileOpen ?? _mobileOpen;
  const collapsed = isCollapsedControlled
    ? collapsedProp
    : sidebar?.collapsed ?? _collapsed;
  const mobileBreakpoint = mobileBreakpointProp ?? sidebar?.mobileBreakpoint ?? 'md';

  const autoCollapsed = useAutoCollapsed(autoCollapseAt);
  const desktopCollapsed = collapsed || autoCollapsed;
  const setMobileOpen = (open: boolean) => {
    if (!isMobileControlled) {
      if (sidebar) sidebar.setMobileOpen(open);
      else _setMobileOpen(open);
    }
    onMobileOpenChange?.(open);
  };
  const [railDragging, setRailDragging] = useState(false);
  const suppressRailClickRef = useRef(false);
  const setCollapsedState = useCallback((next: boolean) => {
    if (next === collapsed) return;
    if (!isCollapsedControlled) {
      if (sidebar) sidebar.setCollapsed(next);
      else _setCollapsed(next);
    }
    onCollapsedChange?.(next);
  }, [collapsed, isCollapsedControlled, sidebar, onCollapsedChange]);
  const handleToggleCollapsed = useCallback(() => {
    setCollapsedState(!collapsed);
  }, [collapsed, setCollapsedState]);

  // Drag-the-edge-to-collapse: drag toward the content to collapse, away from
  // it to expand. Under `dir="rtl"` the rail sits on the left physical edge, so
  // the gesture is measured along the inline axis rather than along x.
  const handleRailPointerDown = useCallback((e: ReactPointerEvent<HTMLButtonElement>) => {
    if (e.button !== 0) return;
    const inlineSign = getComputedStyle(e.currentTarget).direction === "rtl" ? -1 : 1;
    const startX = e.clientX;
    const startCollapsed = collapsed;
    const threshold = 24;
    let resolved = false;
    setRailDragging(true);

    const onMove = (ev: PointerEvent) => {
      const dx = (ev.clientX - startX) * inlineSign;
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

  const responsiveBreakpoint = useSidebarResponsiveBreakpoint();
  const expandedWidth = resolveSidebarWidth(
    widths?.expanded ?? recipe?.expandedWidth,
    responsiveBreakpoint,
    240,
  );
  const collapsedWidth = resolveSidebarWidth(
    widths?.collapsed ?? recipe?.collapsedWidth,
    responsiveBreakpoint,
    64,
  );
  const mobileWidth = resolveSidebarWidth(
    widths?.mobile ?? recipe?.mobileWidth,
    responsiveBreakpoint,
    expandedWidth,
  );
  const railVar = typeof collapsedWidth === 'number' ? `${collapsedWidth}px` : collapsedWidth;
  const sidebarEdgeWidth = bordered === false ? '0px' : recipe?.borderWidth ?? 'var(--border-width, 1px)';
  const showEdgeCollapse = showCollapseButton && collapseButtonPosition === 'edge' && !autoCollapsed;
  const showRailCollapse = showCollapseButton && collapseButtonPosition === 'rail' && !autoCollapsed;
  const effectiveShowSectionLabels = showSectionLabels ?? recipe?.showSectionLabels ?? true;
  const effectiveShowSectionSeparators = showSectionSeparators ?? recipe?.showSectionSeparators ?? false;
  const contentSlot = recipe?.slots?.content;
  const contentStyle = contentSlot?.paddingTop
    ? { paddingTop: contentSlot.paddingTop }
    : undefined;

  // A logo the surrounding NBrandingProvider already published, so a shell that
  // has no logo opinion of its own passes nothing at all.
  const brandingLogo = useMemo<SidebarLogo | null>(() => {
    if (!branding?.logoExpanded && !branding?.logoCollapsed) return null;
    return {
      expanded: branding.logoExpanded,
      collapsed: branding.logoCollapsed,
      fallback: branding.logoFallback,
      href: branding.logoHref,
      alt: branding.appName,
    };
  }, [branding]);

  const brandNode = (value: SidebarLogo, isCollapsed: boolean) => (
    <NSidebarBrand
      logo={value}
      collapsed={isCollapsed}
      linkComponent={linkComponent}
      className={classNames?.sidebarLogo}
    />
  );

  // The object and render-prop forms are handed the resolved collapsed state —
  // including `autoCollapseAt` — so consumers no longer approximate it in CSS.
  const renderLogo = (isMobile: boolean): ReactNode => {
    const isCollapsed = isMobile ? false : desktopCollapsed;
    if (typeof logo === "function") return logo({ collapsed: isCollapsed, isMobile });
    if (isSidebarLogoObject(logo)) {
      return brandNode({ ...logo, alt: logo.alt ?? branding?.appName }, isCollapsed);
    }
    if (logo === undefined) return brandingLogo ? brandNode(brandingLogo, isCollapsed) : undefined;
    return logo;
  };

  const desktopHeaderContent = renderLogo(false);
  const mobileHeaderContent = renderLogo(true);

  const contentProps = {
    groups,
    activePath,
    isActive,
    onNavigate: handleNavigate,
    linkComponent,
    collapsed: desktopCollapsed,
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
    showCollapseButton: showCollapseButton && collapseButtonPosition === 'footer' && !autoCollapsed,
    collapsed: desktopCollapsed,
    onToggleCollapsed: handleToggleCollapsed,
    collapseLabel,
    expandLabel,
    classNames,
  };

  const sidebarInner = (
    <>
      {desktopHeaderContent && <NSidebarHeader collapsed={desktopCollapsed} classNames={classNames}>{desktopHeaderContent}</NSidebarHeader>}
      <NSidebarContent {...contentProps} />
      <NSidebarFooter {...footerProps} />
    </>
  );

  const mobileInner = (
    <>
      {mobileHeaderContent && <NSidebarHeader collapsed={false} classNames={classNames}>{mobileHeaderContent}</NSidebarHeader>}
      <NSidebarContent {...contentProps} collapsed={false} />
      <NSidebarFooter {...footerProps} collapsed={false} isMobile />
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
        data-collapsed={desktopCollapsed ? "true" : "false"}
        data-auto-collapsed={autoCollapsed ? "true" : undefined}
        className={cn(
          "relative z-10 flex flex-col h-full bg-sidebar text-sidebar-foreground transition-all duration-200 shrink-0",
          desktopClass,
          sidebarBorderClasses(bordered, 'end'),
          classNames?.sidebar,
          className
        )}
        style={{
          width: desktopCollapsed ? collapsedWidth : expandedWidth,
          ['--rail' as any]: railVar,
          ['--sidebar-edge-width' as any]: sidebarEdgeWidth,
          ...(bordered !== false && recipe?.borderWidth ? { borderInlineEndWidth: recipe.borderWidth } : {}),
        }}
      >
        {sidebarInner}
        {showRailCollapse && (
          <button
            type="button"
            aria-label={desktopCollapsed ? expandLabel : collapseLabel}
            title={desktopCollapsed ? expandLabel : collapseLabel}
            data-dragging={railDragging ? "true" : undefined}
            onPointerDown={handleRailPointerDown}
            onClick={handleRailClick}
            className="group/rail absolute inset-y-0 end-0 z-20 flex w-3 translate-x-1/2 rtl:-translate-x-1/2 cursor-ew-resize touch-none select-none items-center justify-center border-0 bg-transparent p-0"
          >
            {/* full-height accent line, revealed on hover/drag */}
            <span className="absolute inset-y-0 end-1/2 w-0.5 translate-x-1/2 rtl:-translate-x-1/2 bg-sidebar-ring opacity-0 transition-opacity duration-150 group-hover/rail:opacity-100 group-data-[dragging=true]/rail:opacity-100" />
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
            className="absolute end-0 top-7 z-20 flex size-6 -translate-y-1/2 translate-x-1/2 rtl:-translate-x-1/2 cursor-pointer items-center justify-center rounded-full border border-sidebar-border bg-sidebar text-sidebar-foreground shadow-sm transition-colors hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
          >
            {desktopCollapsed
              ? <ChevronRight className="h-3.5 w-3.5 rtl:-scale-x-100" />
              : <ChevronLeft className="h-3.5 w-3.5 rtl:-scale-x-100" />}
          </button>
        )}
      </aside>
    </>
  );
}
