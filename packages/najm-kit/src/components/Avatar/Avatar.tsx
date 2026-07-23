import React from "react";
import { Avatar as AvatarPrimitive, AvatarFallback, AvatarImage } from "../ui/avatar";
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

export type AvatarShape = "circle" | "rounded" | "square";

export interface AvatarClassNames {
  root?: string;
  avatar?: string;
  image?: string;
  fallback?: string;
  title?: string;
  subtitle?: string;
  meta?: string;
}

export interface AvatarProps {
  src?: string | null;
  title?: string;
  fallback?: string;
  fallbackSrc?: string;
  alt?: string;
  version?: string | number | null;
  srcVersion?: string | number | null;
  size?: "sm" | "md" | "lg" | "xl";
  shape?: AvatarShape;
  subtitle?: string;
  meta?: React.ReactNode;
  className?: string;
  classNames?: AvatarClassNames;
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

const SHAPE_CLASSES: Record<AvatarShape, string> = {
  circle: "rounded-full",
  rounded: "rounded-lg",
  square: "rounded-none",
};

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
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function shouldUseSrc(src?: string | null): src is string {
  return Boolean(src && src !== "noavatar.png");
}

function withVersion(src: string, version?: string | number | null): string {
  if (!version || src.startsWith("data:") || src.startsWith("blob:")) return src;
  const separator = src.includes("?") ? "&" : "?";
  return `${src}${separator}v=${encodeURIComponent(String(version))}`;
}

export function NAvatar({
  src,
  title,
  fallback,
  fallbackSrc,
  alt,
  version,
  srcVersion,
  size = "md",
  shape = "circle",
  subtitle,
  meta,
  className,
  classNames,
}: AvatarProps) {
  const label = title || fallback || "";
  const imageVersion = srcVersion ?? version;
  const imageSrc = shouldUseSrc(src) ? withVersion(src, imageVersion) : fallbackSrc;
  const { bg, text } = nameToColor(label);
  const hasText = Boolean(title || subtitle || meta);
  const fallbackText = fallback && !title ? fallback : label ? getInitials(label) : "?";
  const shapeClass = SHAPE_CLASSES[shape];

  return (
    <div className={cn("flex items-center gap-3", classNames?.root, className)}>
      <AvatarPrimitive
        className={cn(SIZE_CLASSES[size], shapeClass, "flex justify-center items-center overflow-hidden", classNames?.avatar)}
      >
        {imageSrc && (
          <AvatarImage
            src={imageSrc}
            alt={alt || label}
            className={cn("object-cover", classNames?.image)}
          />
        )}
        <AvatarFallback
          style={{ backgroundColor: bg, color: text }}
          className={cn(shapeClass, classNames?.fallback)}
        >
          <span className={cn("font-semibold", TEXT_SIZE_CLASSES[size])}>
            {fallbackText}
          </span>
        </AvatarFallback>
      </AvatarPrimitive>

      {hasText && (
        <div className="flex min-w-0 flex-col">
          {title && (
            <span
              className={cn(
                "truncate font-medium text-foreground",
                TEXT_SIZE_CLASSES[size],
                classNames?.title,
              )}
            >
              {title}
            </span>
          )}
          {subtitle && (
            <span className={cn("truncate text-xs text-muted-foreground", classNames?.subtitle)}>
              {subtitle}
            </span>
          )}
          {meta && (
            <span className={cn("text-xs text-muted-foreground", classNames?.meta)}>
              {meta}
            </span>
          )}
        </div>
      )}
    </div>
  );
}

export { NAvatar as Avatar };

export type NAvatarProps = AvatarProps;
export type NAvatarClassNames = AvatarClassNames;
