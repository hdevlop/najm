import React from "react";
import type { ComponentType } from "react";
import { cn } from "../../lib/cn";
import type { NSidebarLogoProps } from "./types";

export function NSidebarLogo({
  icon,
  title,
  subtitle,
  onClick,
  collapsed = false,
}: NSidebarLogoProps) {
  if (!icon && !title && !subtitle) return null;
  // Render order: a ready element (e.g. <img/>) as-is; a component/forwardRef gets a sized className.
  const IconNode = React.isValidElement(icon)
    ? icon
    : typeof icon === 'function' || (typeof icon === 'object' && icon !== null && '$$typeof' in icon)
      ? React.createElement(icon as ComponentType<{ className?: string }>, { className: 'h-6 w-6 text-primary' })
      : icon;
  // When collapsed, nudge the box back to the rail's center: rail/2 − boxHalf(1.25rem) − headerPad(1rem).
  const collapsedCenter = collapsed
    ? { marginLeft: 'calc(var(--rail, 4rem) / 2 - 2.25rem)' }
    : undefined;
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5  text-left",
        onClick && "cursor-pointer hover:opacity-80 transition-opacity"
      )}
    >
      {IconNode && (
        <div
          className="size-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0"
          style={collapsedCenter}
        >
          {IconNode}
        </div>
      )}
      {!collapsed && (title || subtitle) && (
        <div className="flex flex-col ">
          {title && <span className="text-sm font-semibold text-foreground leading-tight truncate">{title}</span>}
          {subtitle && <span className="text-xs text-muted-foreground leading-tight truncate">{subtitle}</span>}
        </div>
      )}
    </button>
  );
}
