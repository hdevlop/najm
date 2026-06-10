import { cn } from "../../lib/cn";
import type { NSidebarHeaderProps } from "./types";

export function NSidebarHeader({ children, collapsed, className, classNames }: NSidebarHeaderProps) {
  if (!children) return null;
  return (
    <div className={cn(
      "flex items-center h-14 min-h-14 px-4 border-b border-border/70 shrink-0 gap-2 justify-start",
      classNames?.sidebarHeader,
      className
    )}>
      {children}
    </div>
  );
}
