import React, { useMemo } from "react";
import { cn } from "../../lib/cn";
import { NIcon, type NIconSource } from "../Icon";
import { NCard, NCardFooter } from "./Card";

export type NDonutCardVariant = "compact" | "default" | "horizontal";
export type NDonutCardLegendMarker = "dot" | "icon" | "none";

export interface NDonutCardItem {
  id: string;
  label: React.ReactNode;
  value: number;
  color: string;
  icon?: NIconSource;
}

export interface NDonutCardClassNames {
  root?: string;
  content?: string;
  ring?: string;
  center?: string;
  legend?: string;
  legendItem?: string;
  legendMarker?: string;
  legendLabel?: string;
  legendValue?: string;
  empty?: string;
  footer?: string;
}

export interface NDonutCardProps {
  title: React.ReactNode;
  ariaLabel?: string;
  icon?: NIconSource;
  iconColor?: string;
  items: readonly NDonutCardItem[];
  valueFormatter: (value: number) => React.ReactNode;
  centerValueFormatter?: (value: number) => React.ReactNode;
  centerUnit?: React.ReactNode;
  totalLabel?: React.ReactNode;
  centerIcon?: NIconSource;
  emptyLabel?: React.ReactNode;
  footer?: React.ReactNode;
  variant?: NDonutCardVariant;
  legendMarker?: NDonutCardLegendMarker;
  percentageFormatter?: (ratio: number) => React.ReactNode;
  className?: string;
  classNames?: NDonutCardClassNames;
}

const SIZE = {
  compact: { ring: 96, center: 72 },
  default: { ring: 144, center: 112 },
  horizontal: { ring: 128, center: 92 },
} as const;

function normalizeValue(v: number): number {
  if (!Number.isFinite(v) || v <= 0) return 0;
  return v;
}

function buildConicGradient(
  items: readonly NDonutCardItem[],
  total: number,
): string | undefined {
  if (total <= 0) return undefined;
  let running = 0;
  const stops: string[] = [];
  for (const item of items) {
    const v = normalizeValue(item.value);
    if (v <= 0) continue;
    const pct = v / total;
    stops.push(`${item.color} ${running}turn ${running + pct}turn`);
    running += pct;
  }
  if (stops.length === 0) return undefined;
  return `conic-gradient(${stops.join(",")})`;
}

function Marker({ color }: { color: string }) {
  return (
    <span
      className="block h-2.5 w-2.5 shrink-0 rounded-full"
      style={{ backgroundColor: color }}
      aria-hidden="true"
    />
  );
}

function LegendMarker({
  className,
  color,
  icon,
  mode,
}: {
  className?: string;
  color: string;
  icon?: NIconSource;
  mode: NDonutCardLegendMarker;
}) {
  if (mode === "none") return null;
  if (mode === "icon" && icon) {
    return (
      <span
        data-slot="donut-legend-marker"
        className={cn("flex h-3.5 w-3.5 shrink-0 items-center justify-center", className)}
        style={{ color }}
        aria-hidden="true"
      >
        <NIcon icon={icon} className="h-3.5 w-3.5" />
      </span>
    );
  }
  return (
    <span
      data-slot="donut-legend-marker"
      className={className}
      aria-hidden="true"
    >
      <Marker color={color} />
    </span>
  );
}

export function NDonutCard({
  title,
  ariaLabel,
  icon,
  iconColor,
  items,
  valueFormatter,
  centerValueFormatter,
  centerUnit,
  totalLabel,
  centerIcon,
  emptyLabel,
  footer,
  variant = "default",
  legendMarker = "dot",
  percentageFormatter,
  className,
  classNames,
}: NDonutCardProps) {
  const computedTotal = useMemo(
    () => items.reduce((sum, item) => sum + normalizeValue(item.value), 0),
    [items],
  );
  const isZero = computedTotal <= 0;
  const gradient = useMemo(
    () => buildConicGradient(items, computedTotal),
    [items, computedTotal],
  );
  const normalized = useMemo(
    () =>
      items.map((item) => ({
        ...item,
        value: normalizeValue(item.value),
        ratio: computedTotal > 0 ? normalizeValue(item.value) / computedTotal : 0,
      })),
    [items, computedTotal],
  );

  const sz = SIZE[variant];
  const isTitleString = typeof title === "string";
  const accessibleLabel = isTitleString ? title : ariaLabel;
  const isCompact = variant === "compact";
  const isHorizontal = variant === "horizontal";

  const ringStyle: React.CSSProperties = {
    width: sz.ring,
    height: sz.ring,
  };
  if (gradient) ringStyle.background = gradient;

  const centerStyle: React.CSSProperties = {
    width: sz.center,
    height: sz.center,
  };

  return (
    <NCard
      title={title}
      icon={icon}
      iconColor={iconColor}
      bordered
      className={cn(className, classNames?.root)}
      classNames={{ content: "@container p-0" }}
    >
      <div
        data-slot="donut-card"
        data-variant={variant}
        role="group"
        aria-label={accessibleLabel}
        className={cn(
          isHorizontal
            ? "grid grid-cols-1 justify-items-center gap-4 p-2 lg:p-3 xl:p-4 2xl:p-5 @min-[16rem]:grid-cols-[auto_minmax(0,1fr)] @min-[16rem]:items-center @min-[16rem]:justify-items-stretch @min-[16rem]:gap-5"
            : cn(
                "flex flex-col items-center p-2 lg:p-3 xl:p-4 2xl:p-5",
                isCompact ? "gap-2" : "gap-4",
              ),
          classNames?.content,
        )}
      >
        <div
          className={cn("flex flex-col items-center gap-2", isHorizontal && "shrink-0")}
        >
          <div
            data-slot="donut-ring"
            className={cn(
              "relative shrink-0 rounded-full flex items-center justify-center",
              !gradient && "bg-muted",
              classNames?.ring,
            )}
            style={ringStyle}
            aria-hidden="true"
          >
            <div
              data-slot="donut-center"
              className={cn(
                "absolute flex flex-col items-center justify-center rounded-full bg-card",
                classNames?.center,
              )}
              style={centerStyle}
            />
            <div
              data-slot="donut-center-content"
              className={cn(
                "relative z-10 flex max-w-[88%] flex-col items-center justify-center px-1 text-center",
                isCompact ? "gap-0" : "gap-0.5",
              )}
            >
              {centerIcon ? (
                <NIcon icon={centerIcon} className="h-7 w-7 text-muted-foreground" />
              ) : (
                <>
                  <span
                    data-slot="donut-center-value"
                    className={cn(
                      "font-bold tabular-nums text-foreground leading-none break-words",
                      isCompact ? "text-xs" : "text-base",
                      isHorizontal && "text-sm",
                    )}
                  >
                    {(centerValueFormatter ?? valueFormatter)(computedTotal)}
                  </span>
                  {centerUnit ? (
                    <span
                      data-slot="donut-center-unit"
                      className={cn(
                        "font-semibold uppercase leading-none text-foreground",
                        isCompact ? "mt-0.5 text-[8px]" : "mt-1 text-[9px]",
                      )}
                    >
                      {centerUnit}
                    </span>
                  ) : null}
                  {totalLabel ? (
                    <span
                      data-slot="donut-center-label"
                      className={cn(
                        "text-muted-foreground leading-tight break-words",
                        isCompact ? "mt-0.5 text-[8px]" : "mt-0.5 text-[10px]",
                      )}
                    >
                      {totalLabel}
                    </span>
                  ) : null}
                </>
              )}
            </div>
          </div>

          {isZero && emptyLabel ? (
            <p
              data-slot="donut-empty"
              className={cn("text-xs text-muted-foreground text-center", classNames?.empty)}
            >
              {emptyLabel}
            </p>
          ) : null}
        </div>

        <div
          data-slot="donut-legend"
          className={cn(
            "flex flex-col gap-1.5 w-full",
            isCompact && "gap-1",
            isHorizontal && "min-w-0 flex-1 gap-2 pt-0.5 @min-[16rem]:pt-0",
            classNames?.legend,
          )}
        >
          {normalized.map((item) => (
            <div
              key={item.id}
              data-slot="donut-legend-item"
              className={cn(classNames?.legendItem)}
            >
              {isHorizontal ? (
                <div className="flex items-start gap-2">
                  <LegendMarker
                    className={cn("mt-0.5", classNames?.legendMarker)}
                    color={item.color}
                    icon={item.icon}
                    mode={legendMarker}
                  />
                  <div className="flex flex-col min-w-0">
                    <span className={cn("text-xs text-muted-foreground leading-tight", classNames?.legendLabel)}>
                      {item.label}
                    </span>
                    <span
                      className={cn(
                        "whitespace-nowrap text-xs font-semibold tabular-nums text-foreground leading-tight",
                        classNames?.legendValue,
                      )}
                    >
                      {valueFormatter(item.value)}
                      {percentageFormatter ? (
                        <span className="ml-1 text-[11px] font-normal text-muted-foreground">
                          {" · "}{percentageFormatter(item.ratio)}
                        </span>
                      ) : null}
                    </span>
                  </div>
                </div>
              ) : (
                <div
                  className={cn(
                    "flex items-center justify-between gap-2",
                    isCompact ? "text-[11px]" : "text-sm",
                  )}
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <LegendMarker
                      className={classNames?.legendMarker}
                      color={item.color}
                      icon={item.icon}
                      mode={legendMarker}
                    />
                    <span
                      className={cn(
                        "text-muted-foreground truncate",
                        classNames?.legendLabel,
                      )}
                    >
                      {item.label}
                    </span>
                  </div>
                  <span
                    className={cn(
                      "tabular-nums text-foreground whitespace-nowrap",
                      isCompact ? "text-[11px] font-semibold" : "text-sm font-medium",
                      classNames?.legendValue,
                    )}
                  >
                    {valueFormatter(item.value)}
                    {percentageFormatter ? (
                      <span className="text-muted-foreground font-normal ml-0.5">
                        {percentageFormatter(item.ratio)}
                      </span>
                    ) : null}
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {footer ? <NCardFooter className={classNames?.footer}>{footer}</NCardFooter> : null}
    </NCard>
  );
}
