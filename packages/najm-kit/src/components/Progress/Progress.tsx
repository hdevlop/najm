import * as React from "react";
import * as ProgressPrimitive from "@radix-ui/react-progress";
import { cn } from "../../lib/cn";

export type ProgressColor =
  | "primary"
  | "secondary"
  | "accent"
  | "neutral"
  | "success"
  | "warning"
  | "error"
  | "info";

export type ProgressSize = "xs" | "sm" | "md" | "lg" | "xl";
export type ProgressLabelPosition = "inside" | "outside-top" | "outside-right";

const colorTrackMap: Record<ProgressColor, string> = {
  primary: "bg-primary/20",
  secondary: "bg-secondary/20",
  accent: "bg-accent/20",
  neutral: "bg-muted",
  success: "bg-emerald-500/20",
  warning: "bg-amber-500/20",
  error: "bg-destructive/20",
  info: "bg-sky-500/20",
};

const colorIndicatorMap: Record<ProgressColor, string> = {
  primary: "bg-primary",
  secondary: "bg-secondary",
  accent: "bg-accent",
  neutral: "bg-muted-foreground",
  success: "bg-emerald-500",
  warning: "bg-amber-500",
  error: "bg-destructive",
  info: "bg-sky-500",
};

const colorTextMap: Record<ProgressColor, string> = {
  primary: "text-primary-foreground",
  secondary: "text-secondary-foreground",
  accent: "text-accent-foreground",
  neutral: "text-muted-foreground",
  success: "text-white",
  warning: "text-white",
  error: "text-white",
  info: "text-white",
};

const sizeMap: Record<ProgressSize, string> = {
  xs: "h-1",
  sm: "h-1.5",
  md: "h-2",
  lg: "h-3",
  xl: "h-4",
};

const labelSizeMap: Record<ProgressSize, string> = {
  xs: "text-[8px]",
  sm: "text-[9px]",
  md: "text-[10px]",
  lg: "text-[11px]",
  xl: "text-xs",
};

export interface ProgressProps
  extends Omit<React.ComponentProps<typeof ProgressPrimitive.Root>, "color"> {
  color?: ProgressColor;
  size?: ProgressSize;
  indeterminate?: boolean;
  label?: React.ReactNode;
  labelPosition?: ProgressLabelPosition;
}

function Progress({
  className,
  value,
  color = "primary",
  size = "md",
  indeterminate = false,
  label,
  labelPosition = "inside",
  ...props
}: ProgressProps) {
  const pct = value ?? 0;
  const canShowLabel = size !== "xs" && size !== "sm";
  const labelContent = label ?? `${pct}%`;
  const showLabel = label !== undefined && canShowLabel;
  const showOutsideRightLabel = labelPosition === "outside-right" && !indeterminate && canShowLabel;

  const bar = (
    <ProgressPrimitive.Root
      data-slot="progress"
      className={cn(
        "relative w-full overflow-hidden rounded-full",
        colorTrackMap[color],
        sizeMap[size],
        className
      )}
      value={value}
      {...props}
    >
      {indeterminate ? (
        <div
          data-slot="progress-indeterminate"
          className={cn("h-full w-2/5 rounded-full animate-indeterminate-progress", colorIndicatorMap[color])}
        />
      ) : (
        <ProgressPrimitive.Indicator
          data-slot="progress-indicator"
          className={cn("h-full w-full flex-1 rounded-full transition-all", colorIndicatorMap[color])}
          style={{ transform: `translateX(-${100 - pct}%)` }}
        >
          {showLabel && labelPosition === "inside" && pct > 12 && (
            <span
              className={cn(
                "absolute inset-0 flex items-center justify-end pr-1.5 font-medium leading-none",
                labelSizeMap[size],
                colorTextMap[color]
              )}
            >
              {labelContent}
            </span>
          )}
        </ProgressPrimitive.Indicator>
      )}
    </ProgressPrimitive.Root>
  );

  if (showLabel && labelPosition === "outside-top") {
    return (
      <div className="flex w-full flex-col gap-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-medium text-foreground">{label}</span>
          <span className="text-xs text-muted-foreground">{pct}%</span>
        </div>
        {bar}
      </div>
    );
  }

  if (showOutsideRightLabel) {
    return (
      <div className="flex w-full items-center gap-2">
        <div className="flex-1">{bar}</div>
        <span className="text-xs font-medium text-muted-foreground tabular-nums w-8 text-right">{labelContent}</span>
      </div>
    );
  }

  return bar;
}

const NProgress = Progress;

export type NProgressProps = ProgressProps;

export { Progress, NProgress };
