import { cn } from "../../lib/cn";
import { Settings, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import type { NSidebarFooterProps } from "./types";

function DefaultFooter({
  onSettings,
  settingsLabel = 'Settings',
  onLogout,
  logoutLabel = 'Logout',
  collapsed = false,
}: {
  onSettings?: () => void;
  settingsLabel?: string;
  onLogout?: () => void;
  logoutLabel?: string;
  collapsed?: boolean;
}) {
  if (!onSettings && !onLogout) return null;
  const itemClass =
    'flex h-8 w-full cursor-pointer items-center gap-3 rounded-md px-2 text-left text-sm font-medium text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors';

  return (
    <div className="flex flex-col gap-0.5">
      {onSettings && (
        <button type="button" onClick={onSettings} className={itemClass} aria-label={settingsLabel} title={settingsLabel}>
          <Settings className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="flex-1 truncate">{settingsLabel}</span>}
        </button>
      )}
      {onLogout && (
        <button type="button" onClick={onLogout} className={itemClass} aria-label={logoutLabel} title={logoutLabel}>
          <LogOut className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="flex-1 truncate">{logoutLabel}</span>}
        </button>
      )}
    </div>
  );
}

export function NSidebarFooter({
  children,
  onSettings,
  settingsLabel,
  onLogout,
  logoutLabel,
  showCollapseButton,
  collapsed = false,
  onToggleCollapsed,
  collapseLabel = "Collapse",
  expandLabel = "Expand",
  isMobile = false,
  className,
  classNames,
}: NSidebarFooterProps) {
  const defaultFooter = !(onSettings || onLogout) ? null : (
    <DefaultFooter onSettings={onSettings} settingsLabel={settingsLabel} onLogout={onLogout} logoutLabel={logoutLabel} collapsed={collapsed} />
  );
  const footerContent = children ?? defaultFooter;
  const showCollapseInFooter = showCollapseButton && !isMobile;
  const CollapseIcon = collapsed ? PanelLeftOpen : PanelLeftClose;

  if (!footerContent && !showCollapseInFooter) return null;

  return (
    <div className={cn("border-t border-sidebar-border/70 px-4 py-2 shrink-0 flex flex-col gap-1", classNames?.sidebarFooter, className)}>
      {footerContent}
      {showCollapseInFooter && (
        <button
          type="button"
          onClick={onToggleCollapsed}
          className={cn(
            "flex items-center w-full cursor-pointer rounded-md text-sm font-medium transition-colors h-8 text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
            "gap-3 px-2 text-left"
          )}
          aria-label={collapsed ? expandLabel : collapseLabel}
          title={collapsed ? expandLabel : collapseLabel}
        >
          <CollapseIcon className="h-4 w-4 shrink-0" />
          {!collapsed && <span className="flex-1 truncate">{collapseLabel}</span>}
        </button>
      )}
    </div>
  );
}
