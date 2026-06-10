import * as React from "react";
import { cva } from "class-variance-authority";
import { cn } from "../../lib/cn";
import { NBadge } from "../Badge";
import type { BadgeColor, BadgeShape } from "../Badge";

export type IndicatorVertical = "top" | "middle" | "bottom";
export type IndicatorHorizontal = "start" | "center" | "end";
export type IndicatorPosition = `${IndicatorVertical}-${IndicatorHorizontal}`;

export type IndicatorResponsivePosition = Partial<
  Record<"base" | "sm" | "md" | "lg" | "xl" | "2xl", IndicatorPosition>
>;

export type IndicatorOverlay = "dot" | "status" | "badge" | "button" | "custom";
export type IndicatorSize = "sm" | "md" | "lg";

export interface IndicatorProps
  extends Omit<React.HTMLAttributes<HTMLDivElement>, "children" | "content" | "color" | "default"> {
  children: React.ReactNode;
  position?: IndicatorPosition | IndicatorResponsivePosition;
  overlay?: IndicatorOverlay;
  color?: BadgeColor;
  size?: IndicatorSize;
  shape?: BadgeShape;
  content?: React.ReactNode;
  ping?: boolean;
  pulse?: boolean;
  className?: string;
  overlayClassName?: string;
}

const POSITION: Record<IndicatorPosition, string> = {
  "top-start":
    "top-0 start-0 -translate-x-1/2 -translate-y-1/2 rtl:translate-x-1/2",
  "top-center":
    "top-0 start-1/2 -translate-x-1/2 -translate-y-1/2",
  "top-end":
    "top-0 end-0 translate-x-1/2 -translate-y-1/2 rtl:-translate-x-1/2",
  "middle-start":
    "top-1/2 start-0 -translate-x-1/2 -translate-y-1/2 rtl:translate-x-1/2",
  "middle-center":
    "top-1/2 start-1/2 -translate-x-1/2 -translate-y-1/2",
  "middle-end":
    "top-1/2 end-0 translate-x-1/2 -translate-y-1/2 rtl:-translate-x-1/2",
  "bottom-start":
    "bottom-0 start-0 -translate-x-1/2 translate-y-1/2 rtl:translate-x-1/2",
  "bottom-center":
    "bottom-0 start-1/2 -translate-x-1/2 translate-y-1/2",
  "bottom-end":
    "bottom-0 end-0 translate-x-1/2 translate-y-1/2 rtl:-translate-x-1/2",
};

const POSITION_SM: Record<IndicatorPosition, string> = {
  "top-start":
    "sm:top-0 sm:start-0 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rtl:translate-x-1/2",
  "top-center":
    "sm:top-0 sm:start-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2",
  "top-end":
    "sm:top-0 sm:end-0 sm:translate-x-1/2 sm:-translate-y-1/2 sm:rtl:-translate-x-1/2",
  "middle-start":
    "sm:top-1/2 sm:start-0 sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rtl:translate-x-1/2",
  "middle-center":
    "sm:top-1/2 sm:start-1/2 sm:-translate-x-1/2 sm:-translate-y-1/2",
  "middle-end":
    "sm:top-1/2 sm:end-0 sm:translate-x-1/2 sm:-translate-y-1/2 sm:rtl:-translate-x-1/2",
  "bottom-start":
    "sm:bottom-0 sm:start-0 sm:-translate-x-1/2 sm:translate-y-1/2 sm:rtl:translate-x-1/2",
  "bottom-center":
    "sm:bottom-0 sm:start-1/2 sm:-translate-x-1/2 sm:translate-y-1/2",
  "bottom-end":
    "sm:bottom-0 sm:end-0 sm:translate-x-1/2 sm:translate-y-1/2 sm:rtl:-translate-x-1/2",
};

const POSITION_MD: Record<IndicatorPosition, string> = {
  "top-start":
    "md:top-0 md:start-0 md:-translate-x-1/2 md:-translate-y-1/2 md:rtl:translate-x-1/2",
  "top-center":
    "md:top-0 md:start-1/2 md:-translate-x-1/2 md:-translate-y-1/2",
  "top-end":
    "md:top-0 md:end-0 md:translate-x-1/2 md:-translate-y-1/2 md:rtl:-translate-x-1/2",
  "middle-start":
    "md:top-1/2 md:start-0 md:-translate-x-1/2 md:-translate-y-1/2 md:rtl:translate-x-1/2",
  "middle-center":
    "md:top-1/2 md:start-1/2 md:-translate-x-1/2 md:-translate-y-1/2",
  "middle-end":
    "md:top-1/2 md:end-0 md:translate-x-1/2 md:-translate-y-1/2 md:rtl:-translate-x-1/2",
  "bottom-start":
    "md:bottom-0 md:start-0 md:-translate-x-1/2 md:translate-y-1/2 md:rtl:translate-x-1/2",
  "bottom-center":
    "md:bottom-0 md:start-1/2 md:-translate-x-1/2 md:translate-y-1/2",
  "bottom-end":
    "md:bottom-0 md:end-0 md:translate-x-1/2 md:translate-y-1/2 md:rtl:-translate-x-1/2",
};

const POSITION_LG: Record<IndicatorPosition, string> = {
  "top-start":
    "lg:top-0 lg:start-0 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rtl:translate-x-1/2",
  "top-center":
    "lg:top-0 lg:start-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2",
  "top-end":
    "lg:top-0 lg:end-0 lg:translate-x-1/2 lg:-translate-y-1/2 lg:rtl:-translate-x-1/2",
  "middle-start":
    "lg:top-1/2 lg:start-0 lg:-translate-x-1/2 lg:-translate-y-1/2 lg:rtl:translate-x-1/2",
  "middle-center":
    "lg:top-1/2 lg:start-1/2 lg:-translate-x-1/2 lg:-translate-y-1/2",
  "middle-end":
    "lg:top-1/2 lg:end-0 lg:translate-x-1/2 lg:-translate-y-1/2 lg:rtl:-translate-x-1/2",
  "bottom-start":
    "lg:bottom-0 lg:start-0 lg:-translate-x-1/2 lg:translate-y-1/2 lg:rtl:translate-x-1/2",
  "bottom-center":
    "lg:bottom-0 lg:start-1/2 lg:-translate-x-1/2 lg:translate-y-1/2",
  "bottom-end":
    "lg:bottom-0 lg:end-0 lg:translate-x-1/2 lg:translate-y-1/2 lg:rtl:-translate-x-1/2",
};

const POSITION_XL: Record<IndicatorPosition, string> = {
  "top-start":
    "xl:top-0 xl:start-0 xl:-translate-x-1/2 xl:-translate-y-1/2 xl:rtl:translate-x-1/2",
  "top-center":
    "xl:top-0 xl:start-1/2 xl:-translate-x-1/2 xl:-translate-y-1/2",
  "top-end":
    "xl:top-0 xl:end-0 xl:translate-x-1/2 xl:-translate-y-1/2 xl:rtl:-translate-x-1/2",
  "middle-start":
    "xl:top-1/2 xl:start-0 xl:-translate-x-1/2 xl:-translate-y-1/2 xl:rtl:translate-x-1/2",
  "middle-center":
    "xl:top-1/2 xl:start-1/2 xl:-translate-x-1/2 xl:-translate-y-1/2",
  "middle-end":
    "xl:top-1/2 xl:end-0 xl:translate-x-1/2 xl:-translate-y-1/2 xl:rtl:-translate-x-1/2",
  "bottom-start":
    "xl:bottom-0 xl:start-0 xl:-translate-x-1/2 xl:translate-y-1/2 xl:rtl:translate-x-1/2",
  "bottom-center":
    "xl:bottom-0 xl:start-1/2 xl:-translate-x-1/2 xl:translate-y-1/2",
  "bottom-end":
    "xl:bottom-0 xl:end-0 xl:translate-x-1/2 xl:translate-y-1/2 xl:rtl:-translate-x-1/2",
};

const POSITION_2XL: Record<IndicatorPosition, string> = {
  "top-start":
    "2xl:top-0 2xl:start-0 2xl:-translate-x-1/2 2xl:-translate-y-1/2 2xl:rtl:translate-x-1/2",
  "top-center":
    "2xl:top-0 2xl:start-1/2 2xl:-translate-x-1/2 2xl:-translate-y-1/2",
  "top-end":
    "2xl:top-0 2xl:end-0 2xl:translate-x-1/2 2xl:-translate-y-1/2 2xl:rtl:-translate-x-1/2",
  "middle-start":
    "2xl:top-1/2 2xl:start-0 2xl:-translate-x-1/2 2xl:-translate-y-1/2 2xl:rtl:translate-x-1/2",
  "middle-center":
    "2xl:top-1/2 2xl:start-1/2 2xl:-translate-x-1/2 2xl:-translate-y-1/2",
  "middle-end":
    "2xl:top-1/2 2xl:end-0 2xl:translate-x-1/2 2xl:-translate-y-1/2 2xl:rtl:-translate-x-1/2",
  "bottom-start":
    "2xl:bottom-0 2xl:start-0 2xl:-translate-x-1/2 2xl:translate-y-1/2 2xl:rtl:translate-x-1/2",
  "bottom-center":
    "2xl:bottom-0 2xl:start-1/2 2xl:-translate-x-1/2 2xl:translate-y-1/2",
  "bottom-end":
    "2xl:bottom-0 2xl:end-0 2xl:translate-x-1/2 2xl:translate-y-1/2 2xl:rtl:-translate-x-1/2",
};

const BP_MAPS = {
  sm: POSITION_SM,
  md: POSITION_MD,
  lg: POSITION_LG,
  xl: POSITION_XL,
  "2xl": POSITION_2XL,
} as const;

const RESPONSIVE_KEYS = ["sm", "md", "lg", "xl", "2xl"] as const;

function resolvePosition(
  pos: IndicatorPosition | IndicatorResponsivePosition | undefined
): { base: IndicatorPosition; classes: string } {
  if (!pos) {
    return { base: "top-end", classes: POSITION["top-end"] };
  }
  if (typeof pos === "string") {
    return { base: pos, classes: POSITION[pos] };
  }
  const base: IndicatorPosition = pos.base ?? "top-end";
  const extras = RESPONSIVE_KEYS
    .filter((bp) => pos[bp])
    .map((bp) => BP_MAPS[bp][pos[bp] as IndicatorPosition]);
  return { base, classes: cn(POSITION[base], ...extras) };
}

const colorBg: Record<BadgeColor, string> = {
  primary: "bg-pink-500",
  secondary: "bg-indigo-500",
  accent: "bg-orange-500",
  neutral: "bg-slate-500",
  info: "bg-sky-500",
  success: "bg-emerald-500",
  warning: "bg-amber-400",
  destructive: "bg-red-500",
};

const sizeDot: Record<IndicatorSize, string> = {
  sm: "size-2",
  md: "size-3",
  lg: "size-4",
};

const sizeStatus: Record<IndicatorSize, string> = {
  sm: "size-2.5",
  md: "size-3",
  lg: "size-4",
};

export const indicatorVariants = cva("relative inline-flex w-fit", {
  variants: {},
  defaultVariants: {},
});

function DefaultCloseButton() {
  return (
    <button
      type="button"
      aria-label="Dismiss"
      className="flex items-center justify-center size-6 rounded-full bg-destructive text-white text-xs font-semibold hover:bg-destructive/90 transition-colors"
    >
      ×
    </button>
  );
}

function NIndicator({
  children,
  position = "top-end",
  overlay = "dot",
  color = "primary",
  size = "md",
  shape = "default",
  content,
  ping,
  pulse,
  className,
  overlayClassName,
  ...rest
}: IndicatorProps) {
  const { base, classes } = resolvePosition(position);

  return (
    <div
      data-slot="indicator"
      data-position={base}
      className={cn(indicatorVariants(), className)}
      {...rest}
    >
      <span
        data-slot="indicator-overlay"
        data-position={base}
        className={cn("absolute z-10", classes, overlayClassName)}
      >
        {(overlay === "dot" || overlay === "status") && (
          <span
            className={cn(
              "relative inline-flex rounded-full",
              overlay === "dot" ? sizeDot[size] : sizeStatus[size]
            )}
          >
            {ping && (
              <span
                data-slot="indicator-ping"
                aria-hidden="true"
                className={cn(
                  "absolute inset-0 rounded-full animate-ping opacity-60",
                  colorBg[color]
                )}
              />
            )}
            <span
              className={cn(
                "relative rounded-full size-full",
                colorBg[color],
                overlay === "status" && "ring-2 ring-background"
              )}
            />
          </span>
        )}
        {overlay === "badge" && (
          <NBadge
            color={color}
            look="solid"
            shape={shape}
            className={cn(pulse && "animate-pulse")}
          >
            {content}
          </NBadge>
        )}
        {overlay === "button" && (content ?? <DefaultCloseButton />)}
        {overlay === "custom" && content}
      </span>
      {children}
    </div>
  );
}

NIndicator.displayName = "NIndicator";

const Indicator = NIndicator;

export { NIndicator, Indicator };
