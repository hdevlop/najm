import React from "react";
import { Avatar, AvatarFallback, AvatarImage } from "../ui/avatar";
import { cn } from "../../lib/cn";

const AVATAR_COLORS: [string, string][] = [
  ["#3b82f6", "#1d4ed8"],
  ["#8b5cf6", "#6d28d9"],
  ["#ec4899", "#be185d"],
  ["#f97316", "#c2410c"],
  ["#10b981", "#065f46"],
  ["#06b6d4", "#0e7490"],
  ["#f59e0b", "#92400e"],
  ["#ef4444", "#991b1b"],
  ["#84cc16", "#3f6212"],
  ["#a855f7", "#7e22ce"],
];

function nameToColor(name: string): { bg: string; text: string } {
  if (!name) return { bg: "#6b7280", text: "#ffffff" };
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  const [bg] = AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
  return { bg, text: "#ffffff" };
}

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((p) => p.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export interface NAvatarItemClassNames {
  root?: string;
  avatar?: string;
  title?: string;
  subtitle?: string;
  meta?: string;
}

export interface NAvatarItemProps {
  src?: string;
  fallback?: string;
  title?: string;
  subtitle?: string;
  meta?: string | React.ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
  className?: string;
  classNames?: NAvatarItemClassNames;
}

const SIZE_CLASSES = {
  sm: "w-8 h-8",
  md: "w-10 h-10",
  lg: "w-12 h-12",
  xl: "w-16 h-16",
};

const TEXT_SIZE_CLASSES = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-base",
  xl: "text-lg",
};

export function NAvatarItem({
  src,
  fallback,
  title,
  subtitle,
  meta,
  size = "md",
  className,
  classNames,
}: NAvatarItemProps) {
  const name = title || fallback || "";
  const { bg, text } = nameToColor(name);

  return (
    <div className={cn("flex items-center gap-3", classNames?.root, className)}>
      <Avatar className={cn(SIZE_CLASSES[size], "flex justify-center items-center", classNames?.avatar)}>
        {src && <AvatarImage src={src} alt={name} />}
        <AvatarFallback style={{ backgroundColor: bg, color: text }}>
          <span className={cn("font-semibold", TEXT_SIZE_CLASSES[size])}>
            {name ? getInitials(name) : "?"}
          </span>
        </AvatarFallback>
      </Avatar>

      {(title || subtitle || meta) && (
        <div className="flex flex-col min-w-0">
          {title && (
            <span className={cn("font-medium text-foreground truncate", TEXT_SIZE_CLASSES[size], classNames?.title)}>
              {title}
            </span>
          )}
          {subtitle && (
            <span className={cn("text-muted-foreground truncate text-xs", classNames?.subtitle)}>
              {subtitle}
            </span>
          )}
          {meta && (
            <span className={cn("text-muted-foreground text-xs", classNames?.meta)}>
              {meta}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
