import React from "react";
import { Card, CardHeader, CardTitle, CardContent } from "../ui/card";
import { cn } from "../../lib/cn";
import { NLoadingState } from "../feedback/NLoadingState";
import { NErrorState } from "../feedback/NErrorState";
import { NEmptyState } from "../feedback/NEmptyState";
import type { LucideIcon } from "lucide-react";

export interface NAsyncCardClassNames {
  root?: string;
  header?: string;
  title?: string;
  content?: string;
}

export interface NAsyncCardProps {
  title?: string;
  icon?: LucideIcon;
  description?: string;
  children?: React.ReactNode;
  className?: string;
  classNames?: NAsyncCardClassNames;
  headerAction?: React.ReactNode;
  loading?: boolean;
  error?: any;
  empty?: boolean;
  loadingText?: string;
  errorText?: string;
  emptyText?: string;
  onRetry?: () => void;
  skeleton?: React.ReactNode;
  footer?: React.ReactNode;
}

export function NAsyncCard({
  title,
  icon: Icon,
  description,
  children,
  className,
  classNames,
  headerAction,
  loading = false,
  error,
  empty = false,
  loadingText = "Loading...",
  errorText,
  emptyText = "No data available",
  onRetry,
  skeleton,
  footer,
}: NAsyncCardProps) {
  const hasState = loading || error || empty;

  return (
    <Card className={cn("flex flex-col p-4 gap-3", classNames?.root, className)}>
      {title && (
        <CardHeader className={cn("flex w-full justify-between space-y-0 p-0", classNames?.header)}>
          <div className="flex items-center gap-2">
            {Icon && <Icon className="h-5 w-5 text-muted-foreground" />}
            <div>
              <CardTitle className={cn("text-base", classNames?.title)}>{title}</CardTitle>
              {description && <p className="text-sm text-muted-foreground mt-0.5">{description}</p>}
            </div>
          </div>
          {headerAction && <div className="flex items-center">{headerAction}</div>}
        </CardHeader>
      )}

      <CardContent className={cn("flex flex-col flex-1 m-0 p-0", classNames?.content)}>
        {loading && skeleton ? (
          skeleton
        ) : loading ? (
          <NLoadingState label={loadingText} />
        ) : error ? (
          <NErrorState message={typeof error === "string" ? error : errorText || "Something went wrong"} />
        ) : empty ? (
          <NEmptyState title={emptyText} />
        ) : children ? (
          children
        ) : null}
      </CardContent>

      {footer && <div className="pt-2 border-t">{footer}</div>}
    </Card>
  );
}
