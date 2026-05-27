import React, { useState } from "react";
import { cn } from "../../lib/cn";
import { ChevronDown } from "lucide-react";
import type { NavItem, NAppShellClassNames, LinkComponentType } from "./types";

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

function defaultIsActive(item: NavItem, activePath: string): boolean {
  if (item.href) return activePath === item.href;
  if (item.id) return activePath === item.id;
  return false;
}

export function NSidebarItem({
  item,
  activePath = "",
  isActive = defaultIsActive,
  onNavigate,
  linkComponent: LinkComponent,
  collapsed = false,
  depth = 0,
  classNames,
}: SidebarItemProps) {
  const [open, setOpen] = useState(false);
  const active = isActive(item, activePath);
  const hasChildren = item.children && item.children.length > 0;
  const Icon = item.icon;

  const baseClasses = cn(
    "flex items-center gap-3 w-full rounded-md text-sm font-medium transition-colors h-8 px-3 text-left",
    depth > 0 && "pl-9",
    collapsed && "justify-center px-2 text-center",
    item.disabled
      ? "opacity-50 cursor-not-allowed"
      : active
        ? "bg-primary text-primary-foreground"
        : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
    classNames?.sidebarItem
  );

  const handleClick = () => {
    if (item.disabled) return;
    if (hasChildren) {
      setOpen(!open);
      return;
    }
    const target = item.href ?? item.id;
    if (target && onNavigate) {
      onNavigate(target);
    }
  };

  const content = (
    <>
      {Icon && <Icon className={cn("h-4 w-4 shrink-0", collapsed && "h-5 w-5")} />}
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge && <span className="shrink-0 ml-auto">{item.badge}</span>}
          {hasChildren && (
            <ChevronDown
              className={cn("h-4 w-4 shrink-0 transition-transform", open && "rotate-180")}
            />
          )}
        </>
      )}
    </>
  );

  const renderLink = () => {
    if (item.href && LinkComponent && !hasChildren) {
      return (
        <LinkComponent
          href={item.href}
          className={baseClasses}
          onClick={(e) => {
            if (item.disabled) {
              e.preventDefault();
              return;
            }
            onNavigate?.(item.href!);
          }}
        >
          {content}
        </LinkComponent>
      );
    }
    return (
      <button type="button" onClick={handleClick} className={baseClasses} disabled={item.disabled}>
        {content}
      </button>
    );
  };

  return (
    <div>
      {renderLink()}
      {hasChildren && open && !collapsed && (
        <div className="ml-4 mt-0.5 space-y-0.5">
          {item.children!.map((child) => (
            <NSidebarItem
              key={child.id}
              item={child}
              activePath={activePath}
              isActive={isActive}
              onNavigate={onNavigate}
              linkComponent={LinkComponent}
              collapsed={collapsed}
              depth={depth + 1}
              classNames={classNames}
            />
          ))}
        </div>
      )}
    </div>
  );
}
