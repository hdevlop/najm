import React from "react";
import { cn } from "../../lib/cn";
import { Label } from "../ui/label";
import type { LucideIcon } from "lucide-react";

export interface NFormSectionHeaderProps {
  icon?: LucideIcon | React.ComponentType<{ className?: string }>;
  title: string;
  className?: string;
  color?: string;
}

export function NFormSectionHeader({
  icon: Icon,
  title,
  className,
  color = "bg-primary text-primary-foreground",
}: NFormSectionHeaderProps) {
  return (
    <div
      className={cn(
        "w-full flex items-center gap-2 px-2 py-1 rounded-sm",
        color,
        className
      )}
    >
      {Icon && <Icon className="w-4 h-4 shrink-0 text-current" />}
      <Label className="text-sm font-semibold leading-none text-current">{title}</Label>
    </div>
  );
}
