import React from "react";
import {
  Card as CardPrimitive,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "../ui/card";
import { cn } from "../../lib/cn";
import { surfaceBorderClasses } from "../../theme/borders";
import { NLoadingState } from "../feedback/NLoadingState";
import { NErrorState } from "../feedback/NErrorState";
import { NEmptyState } from "../feedback/NEmptyState";
import { NIcon, type NIconSource } from "../Icon";
import { useNajmComponentStyle } from "../../theme/design-provider";
import { resolveRadiusValue } from "../../theme/design-types";

// Slots

export function NCardAction({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
NCardAction.displayName = "NCardAction";

export function NCardFooter({ children }: { children: React.ReactNode; className?: string }) {
  return <>{children}</>;
}
NCardFooter.displayName = "NCardFooter";

export type NCardMediaVariant = "image" | "avatar" | "hero";
export type NCardMediaPlacement = "auto" | "side" | "header" | "top";
export type NCardMediaSize = "sm" | "md" | "lg" | "xl" | number;
export type NCardMediaAspect = "square" | "4/3" | "3/2" | "16/9";

export interface NCardMediaProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: NCardMediaVariant;
  /** `auto` uses side-to-top for images, side-to-header for avatars, and top for heroes. */
  placement?: NCardMediaPlacement;
  /** Side-media size. Presets are 72, 96, 112, and 128 pixels. */
  size?: NCardMediaSize;
  /** Hero aspect ratio. */
  aspect?: NCardMediaAspect;
}

export function NCardMedia({ children }: NCardMediaProps) {
  return <>{children}</>;
}
NCardMedia.displayName = "NCardMedia";

// Types

export interface CardClassNames {
  root?: string;
  media?: string;
  header?: string;
  icon?: string;
  title?: string;
  description?: string;
  content?: string;
  footer?: string;
}

export interface CardProps {
  children?: React.ReactNode;
  onClick?: () => void;

  // Header props
  title?: React.ReactNode;
  description?: React.ReactNode;
  icon?: NIconSource;
  iconColor?: string;

  // Async states
  loading?: boolean;
  error?: any;
  empty?: boolean;
  noData?: boolean;

  // State labels
  loadingText?: string;
  errorText?: string;
  emptyText?: string;
  noDataText?: string;

  // State slots
  skeleton?: React.ReactNode;
  onRetry?: () => void;

  // Layout
  noPadding?: boolean;
  separator?: boolean;
  bordered?: boolean;
  /** Remove the visual surface when NDataCardShell or another parent already owns it. */
  embedded?: boolean;

  // Styling
  className?: string;
  classNames?: CardClassNames;
}

type ResolvedMediaLayout = "responsive-image" | "responsive-avatar" | "side" | "header" | "top";

const CARD_MEDIA_SIZE: Record<Exclude<NCardMediaSize, number>, number> = {
  sm: 72,
  md: 96,
  lg: 112,
  xl: 128,
};

const CARD_MEDIA_ASPECT: Record<NCardMediaAspect, string> = {
  square: "aspect-square",
  "4/3": "aspect-[4/3]",
  "3/2": "aspect-[3/2]",
  "16/9": "aspect-video",
};

function resolveMediaLayout(
  variant: NCardMediaVariant,
  placement: NCardMediaPlacement,
): ResolvedMediaLayout {
  if (placement !== "auto") return placement;
  if (variant === "hero") return "top";
  return variant === "avatar" ? "responsive-avatar" : "responsive-image";
}

function getMediaHtmlProps(props: NCardMediaProps): React.HTMLAttributes<HTMLDivElement> {
  const htmlProps = { ...props };
  delete htmlProps.children;
  delete htmlProps.variant;
  delete htmlProps.placement;
  delete htmlProps.size;
  delete htmlProps.aspect;
  return htmlProps;
}

function mediaRootClasses(layout: ResolvedMediaLayout) {
  if (layout === "top") return "flex flex-col gap-0 overflow-hidden p-0";
  if (layout === "side") return "grid grid-cols-[auto_minmax(0,1fr)] gap-3 p-3";
  if (layout === "header") return "grid grid-cols-[auto_minmax(0,1fr)] gap-3 p-3";
  if (layout === "responsive-avatar") {
    return "grid grid-cols-[auto_minmax(0,1fr)] gap-3 p-3 sm:p-4";
  }
  return "grid grid-cols-[auto_minmax(0,1fr)] gap-3 p-3 sm:flex sm:flex-col sm:p-4";
}

function CardMediaBody({
  children,
  className,
  grouped,
}: Readonly<{
  children: React.ReactNode;
  className?: string;
  grouped: boolean;
}>) {
  if (!grouped) return <>{children}</>;

  return (
    <div data-slot="card-body" className={className}>
      {children}
    </div>
  );
}

// NCard

export function NCard({
  children,
  title,
  description,
  icon,
  iconColor,
  loading = false,
  error,
  empty,
  noData,
  loadingText = "Loading...",
  errorText,
  emptyText,
  noDataText,
  skeleton,
  onRetry,
  noPadding = false,
  separator = false,
  bordered,
  embedded = false,
  className,
  classNames,
  onClick,
}: CardProps) {
  const isEmpty = empty ?? noData ?? false;
  const resolvedEmptyText = emptyText ?? noDataText ?? "No data available";

  const recipe = useNajmComponentStyle("card");
  const recipeRadius = resolveRadiusValue(recipe?.radius);
  const recipeStyle: React.CSSProperties | undefined =
    !embedded && (recipeRadius || recipe?.borderWidth)
      ? {
          ...(recipeRadius ? { borderRadius: recipeRadius } : {}),
          ...(recipe?.borderWidth ? { borderWidth: recipe.borderWidth } : {}),
        }
      : undefined;

  let actionSlot: React.ReactNode = null;
  let footerSlot: React.ReactNode = null;
  let footerClassName: string | undefined;
  let mediaSlot: React.ReactElement<NCardMediaProps> | null = null;
  const mainChildren: React.ReactNode[] = [];

  React.Children.forEach(children, (child) => {
    if (!React.isValidElement(child)) {
      mainChildren.push(child);
      return;
    }
    if (child.type === NCardAction) {
      actionSlot = (child.props as { children?: React.ReactNode }).children;
    } else if (child.type === NCardFooter) {
      const footer = child.props as { children?: React.ReactNode; className?: string };
      footerSlot = footer.children;
      footerClassName = footer.className;
    } else if (child.type === NCardMedia) {
      mediaSlot = child as React.ReactElement<NCardMediaProps>;
    } else {
      mainChildren.push(child);
    }
  });

  const mediaVariant = mediaSlot?.props.variant ?? "image";
  const mediaPlacement = mediaSlot?.props.placement ?? "auto";
  const mediaLayout = mediaSlot ? resolveMediaLayout(mediaVariant, mediaPlacement) : null;
  const mediaSize = mediaSlot?.props.size ?? "md";
  const resolvedMediaSize = typeof mediaSize === "number" ? mediaSize : CARD_MEDIA_SIZE[mediaSize];
  const mediaAspect = mediaSlot?.props.aspect ?? "4/3";
  const mediaHtmlProps = mediaSlot ? getMediaHtmlProps(mediaSlot.props) : {};
  const hasHeader = Boolean(title || description || actionSlot);
  const iconSize = description ? "h-6 w-6 lg:h-8 lg:w-8" : "h-4 w-4 lg:h-5 lg:w-5";
  const mediaStyle = mediaSlot
    ? ({
        ...mediaSlot.props.style,
        "--n-card-media-size": `${resolvedMediaSize}px`,
      } as React.CSSProperties)
    : undefined;

  const sideBody = mediaLayout === "side";
  const headerBody = mediaLayout === "header";
  const responsiveAvatarBody = mediaLayout === "responsive-avatar";
  const responsiveImageBody = mediaLayout === "responsive-image";
  const topBody = mediaLayout === "top";
  const compactSideBody = sideBody || responsiveAvatarBody || responsiveImageBody;

  return (
    <CardPrimitive
      data-bordered={embedded || bordered === false ? "false" : bordered ? "true" : undefined}
      data-embedded={embedded ? "true" : undefined}
      data-media-layout={mediaLayout ?? undefined}
      data-media-variant={mediaSlot ? mediaVariant : undefined}
      onClick={onClick}
      style={recipeStyle}
      className={cn(
        mediaLayout ? mediaRootClasses(mediaLayout) : "flex flex-col",
        !mediaLayout && !noPadding && "p-2 lg:p-3 2xl:p-4 gap-3",
        mediaLayout && noPadding && "p-0",
        embedded && "rounded-none bg-transparent shadow-none",
        surfaceBorderClasses(embedded ? false : bordered),
        classNames?.root,
        className,
      )}
    >
      {mediaSlot ? (
        <div
          {...mediaHtmlProps}
          data-slot="card-media"
          data-placement={mediaPlacement}
          data-variant={mediaVariant}
          data-size={mediaSize}
          style={mediaStyle}
          className={cn(
            mediaVariant !== "avatar" && "relative overflow-hidden bg-muted",
            mediaVariant === "image" && "col-start-1 row-start-1 size-[var(--n-card-media-size)] self-start rounded-lg",
            mediaVariant === "image" && responsiveImageBody && "sm:h-40 sm:w-full sm:shrink-0",
            mediaVariant === "avatar" && "col-start-1 row-start-1 flex w-[var(--n-card-media-size)] items-start justify-center",
            mediaVariant === "avatar" && (headerBody || responsiveAvatarBody || topBody) && "sm:justify-start",
            mediaVariant === "hero" && cn("w-full", CARD_MEDIA_ASPECT[mediaAspect]),
            mediaLayout === "top" && mediaVariant === "image" && "h-40 w-full rounded-none",
            classNames?.media,
            mediaSlot.props.className,
          )}
        >
          {mediaSlot.props.children}
        </div>
      ) : null}

      <CardMediaBody
        grouped={compactSideBody}
        className={cn(
          "col-start-2 row-start-1 flex min-w-0 flex-col gap-2 self-start",
          (responsiveAvatarBody || responsiveImageBody) && "sm:contents",
        )}
      >
        {hasHeader ? (
          <CardHeader
            className={cn(
              "flex min-w-0 flex-row items-center justify-between space-y-0 p-0",
              mediaLayout && "col-start-2 row-start-1",
              responsiveImageBody && "sm:col-auto sm:row-auto",
              topBody && "p-4 pb-0",
              classNames?.header,
            )}
          >
            <div className="flex min-w-0 items-center gap-2">
              {icon ? (
                <NIcon
                  icon={icon}
                  className={cn(iconSize, "shrink-0 text-muted-foreground", iconColor, classNames?.icon)}
                />
              ) : null}
              <div className="min-w-0">
                {title ? (
                  <CardTitle className={cn("truncate text-sm leading-snug lg:text-base", classNames?.title)}>
                    {title}
                  </CardTitle>
                ) : null}
                {description ? (
                  <CardDescription className={cn("mt-0.5 text-xs", classNames?.description)}>
                    {description}
                  </CardDescription>
                ) : null}
              </div>
            </div>
            {actionSlot ? <div className="ml-2 flex shrink-0 items-center gap-2">{actionSlot}</div> : null}
          </CardHeader>
        ) : null}

        {hasHeader && separator ? (
          <div
            className={cn(
              "border-t border-border",
              sideBody && "col-start-2",
              headerBody && "col-span-full",
              responsiveAvatarBody && "col-start-2 sm:col-span-full",
              responsiveImageBody && "col-start-2 sm:col-auto",
              topBody && "mx-4",
            )}
          />
        ) : null}

        <CardContent
          className={cn(
            "m-0 flex min-w-0 flex-col gap-2 p-0",
            sideBody && "col-start-2",
            headerBody && "col-span-full",
            responsiveAvatarBody && "col-start-2 sm:col-span-full",
            responsiveImageBody && "col-start-2 sm:col-auto",
            topBody && "p-4",
            classNames?.content,
          )}
        >
          {loading && skeleton ? (
            skeleton
          ) : loading ? (
            <NLoadingState label={loadingText} />
          ) : error ? (
            <NErrorState
              message={typeof error === "string" ? error : errorText ?? "Something went wrong"}
              onRetry={onRetry}
            />
          ) : isEmpty ? (
            <NEmptyState title={resolvedEmptyText} />
          ) : (
            mainChildren
          )}
        </CardContent>

        {footerSlot ? (
          <CardFooter
            className={cn(
              "mt-auto p-0 pt-3",
              sideBody && "col-start-2",
              headerBody && "col-span-full",
              responsiveAvatarBody && "col-start-2 sm:col-span-full",
              responsiveImageBody && "col-start-2 sm:col-auto",
              topBody && "border-t border-border p-4",
              classNames?.footer,
              footerClassName,
            )}
          >
            {footerSlot}
          </CardFooter>
        ) : null}
      </CardMediaBody>
    </CardPrimitive>
  );
}

export { NCard as AsyncCard };

export type NCardProps = CardProps;
export type NCardClassNames = CardClassNames;
