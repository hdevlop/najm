import React, { useState, useCallback, useEffect } from "react";
import { cn } from "../../lib/cn";
import { NSidebar } from "../sidebar/NSidebar";
import { NNavbar } from "./NNavbar";
import { NajmScroll } from "../ui/scroll";
import type { NAppShellProps, NavItem } from "./types";

export function NAppShell({
  children,
  logo,
  title,
  navItems = [],
  activePath = "",
  onNavigate,
  isActive,
  linkComponent,
  user,
  actions = [],
  userMenuActions = [],
  onLogout,
  collapsed: controlledCollapsed,
  defaultCollapsed = false,
  onCollapsedChange,
  collapseButtonPosition,
  widths,
  sidebarFooter,
  navbarLeft,
  navbarRight,
  classNames,
}: NAppShellProps) {
  const [internalCollapsed, setInternalCollapsed] = useState(defaultCollapsed);
  const [mobileOpen, setMobileOpen] = useState(false);

  const collapsed = controlledCollapsed ?? internalCollapsed;

  const handleToggleCollapsed = useCallback(() => {
    const next = !collapsed;
    if (onCollapsedChange) {
      onCollapsedChange(next);
    } else {
      setInternalCollapsed(next);
    }
  }, [collapsed, onCollapsedChange]);

  const handleToggleMobile = useCallback(() => {
    setMobileOpen((prev) => !prev);
  }, []);

  const handleNavigate = useCallback(
    (href: string) => {
      onNavigate?.(href);
      setMobileOpen(false);
    },
    [onNavigate]
  );

  // Close mobile sidebar on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  return (
    <div className={cn("flex h-screen overflow-hidden", classNames?.root)}>
      {/* Sidebar — owns its own mobile drawer, overlay, and hamburger */}
      <NSidebar
        logo={logo}
        navItems={navItems}
        activePath={activePath}
        isActive={isActive}
        onNavigate={handleNavigate}
        linkComponent={linkComponent}
        collapsed={collapsed}
        onCollapsedChange={handleToggleCollapsed}
        footer={sidebarFooter}
        collapseButtonPosition={collapseButtonPosition}
        widths={widths}
        classNames={classNames}
        mobileOpen={mobileOpen}
        onMobileOpenChange={setMobileOpen}
        showHamburgerButton={false}
      />

      {/* Main area */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        <NNavbar
          title={title}
          logo={logo}
          user={user}
          actions={actions}
          userMenuActions={userMenuActions}
          onLogout={onLogout}
          onToggleSidebar={handleToggleCollapsed}
          onToggleMobile={handleToggleMobile}
          leftSlot={navbarLeft}
          rightSlot={navbarRight}
          classNames={classNames}
        />

        <NajmScroll element="main" axis="y" className={cn("flex-1", classNames?.content)}>
          {children}
        </NajmScroll>
      </div>
    </div>
  );
}
