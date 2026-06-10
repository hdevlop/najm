import React from "react";
import { Card as CardPrimitive, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../ui/card";
import { cn } from "../../lib/cn";
import { borderColorClassForDegree, useResolvedBorderDegree } from "../../theme/borders";
import type { NajmBorderDegree } from "../../theme/types";
import { NLoadingState } from "../feedback/NLoadingState";
import { NErrorState } from "../feedback/NErrorState";
import { NEmptyState } from "../feedback/NEmptyState";
import { NIcon, type NIconSource } from "../Icon";

// ─── Slots ───────────────────────────────────────────────────────────────────

export function NCardAction({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
NCardAction.displayName = "NCardAction";

export function NCardFooter({ children, className }: { children: React.ReactNode; className?: string }) {
  return <>{children}</>;
}
NCardFooter.displayName = "NCardFooter";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CardClassNames {
  root?: string;
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
  title?: string;
  description?: string;
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
  borderDegree?: NajmBorderDegree;

  // Styling
  className?: string;
  classNames?: CardClassNames;
}

// ─── NCard ───────────────────────────────────────────────────────────────────

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
  borderDegree,
  className,
  classNames,
  onClick,
}: CardProps) {
  const isEmpty = empty ?? noData ?? false;
  const resolvedEmptyText = emptyText ?? noDataText ?? "No data available";

  const resolvedBorderDegree = useResolvedBorderDegree({
    borderDegree,
    bordered,
    fallback: "default",
  });

  let actionSlot: React.ReactNode = null;
  let footerSlot: React.ReactNode = null;
  const mainChildren: React.ReactNode[] = [];

  React.Children.forEach(children, (child) => {
    if (React.isValidElement(child)) {
      if (child.type === NCardAction) {
        actionSlot = child;
      } else if (child.type === NCardFooter) {
        footerSlot = child;
      } else {
        mainChildren.push(child);
      }
    } else {
      mainChildren.push(child);
    }
  });

  const hasHeader = !!(title || description || actionSlot);
  const iconSize = description ? "h-8 w-8" : "h-5 w-5";

  const isStrong = resolvedBorderDegree === "strong";
  const isNone = resolvedBorderDegree === "none";

  return (
    <CardPrimitive
      data-bordered={bordered ? "true" : undefined}
      data-border-degree={resolvedBorderDegree}
      onClick={onClick}
      className={cn(
        "flex flex-col",
        !noPadding && "p-4 gap-3",
        isNone
          ? "border-transparent"
          : `${borderColorClassForDegree(resolvedBorderDegree)} ${isStrong ? "shadow-none" : ""}`,
        classNames?.root,
        className
      )}
    >
      {hasHeader && (
        <CardHeader className={cn("flex flex-row items-center justify-between space-y-0 p-0", classNames?.header)}>
          <div className="flex items-center gap-2 min-w-0">
            {icon && (
              <NIcon icon={icon} className={cn(iconSize, "shrink-0 text-muted-foreground", iconColor, classNames?.icon)} />
            )}
            <div className="min-w-0">
              {title && (
                <CardTitle className={cn("text-base leading-snug", classNames?.title)}>
                  {title}
                </CardTitle>
              )}
              {description && (
                <CardDescription className={cn("text-xs mt-0.5", classNames?.description)}>
                  {description}
                </CardDescription>
              )}
            </div>
          </div>
          {actionSlot && (
            <div className="flex items-center gap-2 shrink-0 ml-2">{actionSlot}</div>
          )}
        </CardHeader>
      )}

      {hasHeader && separator && <div className="border-t border-border" />}

      <CardContent className={cn("flex flex-col flex-1 m-0 p-0", classNames?.content)}>
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

      {footerSlot && (
        <CardFooter className={cn("p-0 pt-3 border-t border-border mt-auto", classNames?.footer)}>
          {footerSlot}
        </CardFooter>
      )}
    </CardPrimitive>
  );
}

export { NCard as AsyncCard };

export type NCardProps = CardProps;
export type NCardClassNames = CardClassNames;
