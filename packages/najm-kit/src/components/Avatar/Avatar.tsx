import React from "react";
import { Avatar as AvatarPrimitive, AvatarFallback } from "../ui/avatar";
import { cn } from "../../lib/cn";
import { resolveAvatarSrc } from "../../lib/avatar";
import { normalizeImageSources } from "../../lib/imageSource";
import { useImageChain } from "../../hooks/useImageChain";

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

/**
 * Native image attributes forwarded to the avatar's `<img>`.
 *
 * `src`, `alt`, and `className` are excluded because this component resolves
 * them: the source comes from the primary/fallback chain, the alt text from
 * `alt`/`title`, and the class from `classNames.image`.
 *
 * Typed off the native element rather than a framework image component on
 * purpose — see the note on `NAvatar` about why the avatar loads its image
 * directly through the browser.
 */
export type NAvatarImageProps = Omit<
  React.ImgHTMLAttributes<HTMLImageElement>,
  "src" | "alt" | "className"
>;

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
  /**
   * Escape hatch onto the underlying `<img>`: `loading`, `sizes`,
   * `crossOrigin`, `referrerPolicy`, `decoding`, and the load/error handlers.
   *
   * `onLoad` and `onError` are composed with this component's own state rather
   * than replacing it, so supplying them does not break the fallback chain.
   */
  imageProps?: NAvatarImageProps;
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

/**
 * Person or record avatar: an image with a fallback image behind it, initials
 * behind that, and an optional title/subtitle/meta column beside it.
 *
 * The image is a native `<img>`, not a framework image component and not
 * Radix's `AvatarImage`. Two reasons, both load-bearing:
 *
 * - Radix preloads through `new window.Image()` and mounts the element only
 *   once the bytes have arrived, which discards the element's own load and
 *   error events and makes `loading="lazy"` inert. This component has to expose
 *   both.
 * - Loading directly through the browser is what lets a same-origin protected
 *   route work at all: the request carries the session the page already has,
 *   and no optimizer sits between the two. The package therefore never needs to
 *   know which routes an application protects.
 */
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
  imageProps,
}: AvatarProps) {
  const label = title || fallback || "";
  const imageVersion = srcVersion ?? version;
  // The placeholder filter runs before the chain, so a seeded `noavatar.png`
  // falls through to `fallbackSrc` rather than becoming the first attempt.
  const sources = normalizeImageSources(
    [resolveAvatarSrc(src, undefined), fallbackSrc],
    imageVersion,
  );
  const chain = useImageChain(sources);
  const { bg, text } = nameToColor(label);
  const hasText = Boolean(title || subtitle || meta);
  const fallbackText = fallback && !title ? fallback : label ? getInitials(label) : "?";
  const shapeClass = SHAPE_CLASSES[shape];

  const {
    onLoad: onImageLoad,
    onError: onImageError,
    loading: imageLoading,
    ...restImageProps
  } = imageProps ?? {};

  const imageRef = React.useRef<HTMLImageElement | null>(null);
  const { markLoaded } = chain;

  // An image already in the browser cache can finish before React attaches the
  // load handler — during hydration it is usually already complete by the time
  // the element is claimed. Without this the initials would never come down.
  // Only the success direction is inferred: `complete` with no natural width is
  // also the state of an element that has not started, so treating it as a
  // failure here would burn through the chain on mount.
  React.useEffect(() => {
    const element = imageRef.current;
    if (element?.complete && element.naturalWidth > 0) markLoaded();
  }, [chain.src, markLoaded]);

  const showImage = Boolean(chain.src) && !chain.exhausted;
  // Initials stay mounted until an image has actually painted, and come back
  // when every source has failed. While both are mounted the image is absolutely
  // positioned over the initials, so it does not push them out of the box; once
  // it loads they unmount, which is what keeps a transparent PNG from showing
  // letters through its own pixels.
  const showFallback = !showImage || !chain.loaded;

  return (
    <div className={cn("flex items-center gap-3", classNames?.root, className)}>
      <AvatarPrimitive
        className={cn(SIZE_CLASSES[size], shapeClass, "flex justify-center items-center overflow-hidden bg-muted", classNames?.avatar)}
      >
        {showImage && (
          <img
            {...restImageProps}
            ref={imageRef}
            data-slot="avatar-image"
            src={chain.src}
            alt={alt || label}
            loading={imageLoading ?? "lazy"}
            className={cn("absolute inset-0 size-full object-cover", classNames?.image)}
            onLoad={(event) => {
              markLoaded();
              onImageLoad?.(event);
            }}
            onError={(event) => {
              chain.markFailed();
              onImageError?.(event);
            }}
          />
        )}
        {showFallback && (
          // Mounted by this component rather than by Radix's loading status:
          // the status is driven by a preloader we deliberately do not use, so
          // the visibility decision belongs here alongside the chain state.
          <AvatarFallback
            style={{ backgroundColor: bg, color: text }}
            className={cn(shapeClass, classNames?.fallback)}
          >
            <span className={cn("font-semibold", TEXT_SIZE_CLASSES[size])}>
              {fallbackText}
            </span>
          </AvatarFallback>
        )}
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
