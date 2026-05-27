import React from "react";
import { cn } from "../../lib/cn";
import { Skeleton } from "../ui/skeleton";
import type { LucideIcon } from "lucide-react";

export interface NStatCardClassNames {
  root?: string;
  icon?: string;
  label?: string;
  value?: string;
  description?: string;
}

export interface NStatCardProps {
  label: string;
  value: string | number;
  description?: string;
  icon?: LucideIcon;
  trend?: {
    value: number;
    direction: "up" | "down" | "neutral";
    label?: string;
  };
  loading?: boolean;
  renderValue?: (value: string | number) => React.ReactNode;
  className?: string;
  classNames?: NStatCardClassNames;
}

const TREND_COLORS = {
  up: "text-green-600",
  down: "text-red-600",
  neutral: "text-muted-foreground",
};

const TREND_SYMBOLS = {
  up: "↑",
  down: "↓",
  neutral: "→",
};

export function NStatCard({
  label,
  value,
  description,
  icon: Icon,
  trend,
  loading = false,
  renderValue,
  className,
  classNames,
}: NStatCardProps) {
  if (loading) {
    return (
      <div className={cn("rounded-xl border bg-card p-5 shadow-sm", classNames?.root, className)}>
        <Skeleton className="h-4 w-24 mb-3" />
        <Skeleton className="h-8 w-16 mb-2" />
        <Skeleton className="h-3 w-32" />
      </div>
    );
  }

  return (
    <div className={cn("rounded-xl border bg-card p-5 shadow-sm transition-all duration-200 hover:shadow-md", classNames?.root, className)}>
      <div className="flex items-start justify-between">
        <div className="flex-1 min-w-0">
          <p className={cn("text-sm font-medium text-muted-foreground truncate", classNames?.label)}>{label}</p>
          <div className={cn("text-2xl font-bold mt-1", classNames?.value)}>
            {renderValue ? renderValue(value) : value}
          </div>
          {description && (
            <p className={cn("text-sm text-muted-foreground mt-1", classNames?.description)}>{description}</p>
          )}
          {trend && (
            <div className={cn("flex items-center gap-1 mt-2 text-sm font-medium", TREND_COLORS[trend.direction])}>
              <span>{TREND_SYMBOLS[trend.direction]}</span>
              <span>{Math.abs(trend.value)}%</span>
              {trend.label && <span className="text-muted-foreground font-normal ml-1">{trend.label}</span>}
            </div>
          )}
        </div>
        {Icon && (
          <div className={cn("flex items-center justify-center w-12 h-12 rounded-full bg-muted shrink-0", classNames?.icon)}>
            <Icon className="w-6 h-6 text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}
