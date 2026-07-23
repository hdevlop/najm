import React from "react";
import { cn } from "../../lib/cn";
import { Tooltip, TooltipContent, TooltipTrigger } from "../ui/tooltip";
import { NIcon, type NIconSource } from "../Icon";

// ─── NDetailCard ───────────────────────────────────────────────

export interface NDetailCardClassNames {
  root?: string;
  header?: string;
  title?: string;
  content?: string;
}

export interface NDetailCardProps {
  title?: string;
  description?: string;
  icon?: NIconSource;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  classNames?: NDetailCardClassNames;
}

export function NDetailCard({
  title,
  description,
  icon,
  action,
  children,
  className,
  classNames,
}: NDetailCardProps) {
  return (
    <div className={cn("flex flex-col rounded-lg border bg-card p-5 shadow-sm", classNames?.root, className)}>
      {(title || description || action) && (
        <div className={cn("flex items-start justify-between mb-4", classNames?.header)}>
          <div className="flex items-center gap-3">
            {icon && (
              <div className="flex items-center justify-center w-10 h-10 rounded-full bg-muted">
                <NIcon icon={icon} className="w-5 h-5 text-muted-foreground" />
              </div>
            )}
            <div>
              {title && <h3 className={cn("text-lg font-semibold text-foreground", classNames?.title)}>{title}</h3>}
              {description && <p className="text-sm text-muted-foreground">{description}</p>}
            </div>
          </div>
          {action && <div className="flex items-center gap-2 shrink-0">{action}</div>}
        </div>
      )}
      <div className={cn("flex-1", classNames?.content)}>{children}</div>
    </div>
  );
}

// ─── NDetailItem ────────────────────────────────────────────────

function truncateText(text: string, maxChars: number, suffix = "..."): string {
  if (!text) return "";
  return text.length <= maxChars ? text : text.slice(0, maxChars) + suffix;
}

export interface NDetailItemProps {
  icon?: NIconSource;
  label: string;
  value: string | React.ReactNode;
  valueClassName?: string;
  iconClassName?: string;
  className?: string;
  maxChars?: number;
}

export function NDetailItem({
  icon,
  label,
  value,
  valueClassName,
  iconClassName,
  className,
  maxChars = 20,
}: NDetailItemProps) {
  const stringValue = typeof value === "string" ? value : "";
  const isTruncated = stringValue.length > maxChars;
  const displayValue = typeof value === "string" ? truncateText(stringValue, maxChars) : value;

  return (
    <div className={cn("flex items-center gap-2", className)}>
      {icon && <NIcon icon={icon} className={cn("w-4 h-4 text-muted-foreground", iconClassName)} />}
      <span className="text-sm text-muted-foreground">{label}:</span>
      {isTruncated ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={cn("text-sm cursor-help text-foreground", valueClassName)}>{displayValue}</span>
          </TooltipTrigger>
          <TooltipContent>
            <p className="max-w-xs">{stringValue}</p>
          </TooltipContent>
        </Tooltip>
      ) : (
        <span className={cn("text-sm text-foreground", valueClassName)}>{displayValue}</span>
      )}
    </div>
  );
}

// ─── NDetailList ────────────────────────────────────────────────

export interface NDetailListItem {
  icon?: NIconSource;
  label: string;
  value: string | React.ReactNode;
  valueClassName?: string;
  iconClassName?: string;
}

export interface NDetailListProps {
  items: NDetailListItem[];
  className?: string;
  itemClassName?: string;
}

export function NDetailList({ items, className, itemClassName }: NDetailListProps) {
  return (
    <div className={cn("space-y-2", className)}>
      {items.map((item, index) => (
        <NDetailItem
          key={`${item.label}-${index}`}
          icon={item.icon}
          label={item.label}
          value={item.value}
          valueClassName={item.valueClassName}
          iconClassName={item.iconClassName}
          className={itemClassName}
        />
      ))}
    </div>
  );
}
