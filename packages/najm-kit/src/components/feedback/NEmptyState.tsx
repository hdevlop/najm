import React from "react";
import type { LucideIcon } from "lucide-react";
import { cn } from "../../lib/cn";

export interface NEmptyStateProps {
  title?: string;
  description?: string;
  icon?: React.ReactNode | LucideIcon;
  action?: React.ReactNode;
  className?: string;
}

export function NEmptyState({ title = "No data", description, icon, action, className }: NEmptyStateProps) {
  const iconContent = icon
    ? React.isValidElement(icon)
      ? icon
      : React.createElement(icon as React.ElementType, { className: "h-8 w-8" })
    : null;

  return (
    <div className={cn("flex flex-col items-center justify-center gap-3 py-12", className)}>
      {iconContent && <div className="text-muted-foreground/50">{iconContent}</div>}
      <div className="text-center">
        <h3 className="font-semibold text-foreground">{title}</h3>
        {description && <p className="text-muted-foreground text-sm mt-1">{description}</p>}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
