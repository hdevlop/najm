import React, { useState, useCallback, useEffect } from "react";
import { cn } from "../../lib/cn";
import { NSidebar } from "./NSidebar";
import { NNavbar } from "./NNavbar";
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
      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className={cn("fixed inset-0 z-40 bg-black/50 lg:hidden", classNames?.overlay)}
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "shrink-0 z-50 transition-transform duration-200 lg:relative lg:translate-x-0",
          mobileOpen ? "translate-x-0 fixed inset-y-0 left-0" : "-translate-x-full fixed inset-y-0 left-0 lg:relative"
        )}
      >
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
          classNames={classNames}
        />
      </div>

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

        <main className={cn("flex-1 overflow-y-auto", classNames?.content)}>
          {children}
        </main>
      </div>
    </div>
  );
}
