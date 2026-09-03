import React, { useEffect, useState } from "react";
import { cn } from "../../lib/cn";
import { ChevronDown } from "lucide-react";
import type { SidebarItemProps, NavItem } from "./types";

function defaultIsActive(item: NavItem, activePath: string): boolean {
  if (item.href) return activePath === item.href;
  if (item.id) return activePath === item.id;
  return false;
}

function hasActiveChild(item: NavItem, activePath: string, isActive: (item: NavItem, activePath: string) => boolean): boolean {
  return Boolean(item.children?.some((child) => isActive(child, activePath) || hasActiveChild(child, activePath, isActive)));
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
  const active = isActive(item, activePath);
  const hasChildren = item.children && item.children.length > 0;
  const childActive = hasActiveChild(item, activePath, isActive);
  const [open, setOpen] = useState(childActive);
  const Icon = item.icon;

  useEffect(() => {
    if (childActive) setOpen(true);
  }, [childActive]);

  const baseClasses = cn(
    "flex items-center gap-3 w-full rounded-md text-sm px-2 font-medium transition-colors h-8 text-start",
    depth > 0 && "ps-7",
    collapsed && "ps-[calc((var(--rail,4rem)-var(--sidebar-edge-width,0px))/2-var(--spacing,0.25rem)-var(--spacing,0.25rem)-var(--spacing,0.25rem)-var(--spacing,0.25rem)-var(--spacing,0.25rem)-var(--spacing,0.25rem))]",
    item.disabled
      ? "opacity-50 cursor-not-allowed"
      : active
        ? "cursor-pointer bg-sidebar-primary text-sidebar-primary-foreground"
        : "cursor-pointer text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground",
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
      {Icon && <Icon className="h-4 w-4 shrink-0" />}
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{item.label}</span>
          {item.badge && <span className="shrink-0 ms-auto">{item.badge}</span>}
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

  if (!hasChildren) return renderLink();

  return (
    <div>
      {renderLink()}
      {open && !collapsed && (
        <div className="flex flex-col gap-1">
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
