import React, { useMemo } from "react";

import { cn } from "../../lib/cn";
import { NCard } from "../Card/Card";
import { NSkeleton } from "../feedback/NSkeletonPresets";
import type {
  NBarChartProps,
  NCartesianChartProps,
  NChartDatum,
  NChartItem,
  NChartSeries,
  NChartSize,
  NChartSkeletonProps,
  NLineChartProps,
  NPieChartProps,
  NStatusBreakdownProps,
} from "./types";

const CHART_PALETTE_SIZE = 5;
const SIZE_PRESETS = { sm: 112, md: 160, lg: 208 } as const;

export function getNChartColor(index: number, override?: string) {
  return override ?? `var(--chart-${(Math.max(0, index) % CHART_PALETTE_SIZE) + 1})`;
}

function chartSize(size: NChartSize | undefined, fallback = SIZE_PRESETS.md) {
  if (typeof size === "number") return Math.min(480, Math.max(64, size));
  return size ? SIZE_PRESETS[size] : fallback;
}

function numberValue(value: number | undefined) {
  return Number.isFinite(value) && (value ?? 0) > 0 ? Number(value) : 0;
}

function accessibleLabel(title: React.ReactNode, ariaLabel?: string) {
  return typeof title === "string" ? title : ariaLabel;
}

function ChartLegend({ series }: { series: readonly NChartSeries[] }) {
  return (
    <div className="mb-3 flex flex-wrap gap-x-4 gap-y-1" data-slot="chart-legend">
      {series.map((item, index) => (
        <span className="flex items-center gap-2 text-xs text-muted-foreground" key={item.id}>
          <span
            aria-hidden="true"
            className="size-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: getNChartColor(index, item.color) }}
          />
          {item.label}
        </span>
      ))}
    </div>
  );
}

function EmptyChart({ children }: { children?: React.ReactNode }) {
  return (
    <div className="flex min-h-40 items-center justify-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

function LoadingCard({
  className,
  icon,
  iconColor,
  label,
  title,
  variant,
}: Pick<NCartesianChartProps, "className" | "icon" | "iconColor" | "title"> & {
  label?: string;
  variant: NChartSkeletonProps["variant"];
}) {
  return (
    <NCard className={cn("h-full", className)} icon={icon} iconColor={iconColor} title={title}>
      <div aria-busy="true" aria-label={label ?? "Loading"} className="min-h-40" role="status">
        <NChartSkeleton variant={variant} />
      </div>
    </NCard>
  );
}

export function NChartSkeleton({
  className,
  points = 12,
  rows = 4,
  variant = "bar",
}: NChartSkeletonProps) {
  if (variant === "pie") {
    return (
      <div className={cn("flex items-center gap-5 py-3 sm:flex-col", className)} aria-hidden="true">
        <NSkeleton className="size-32 shrink-0 rounded-full" />
        <div className="w-full flex-1 space-y-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div className="flex items-center justify-between gap-4" key={index}>
              <NSkeleton className="h-3 w-24" />
              <NSkeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (variant === "status") {
    return (
      <div className={cn("space-y-4 py-2", className)} aria-hidden="true">
        {Array.from({ length: rows }, (_, index) => (
          <div className="space-y-2" key={index}>
            <div className="flex justify-between"><NSkeleton className="h-3 w-24" /><NSkeleton className="h-3 w-8" /></div>
            <NSkeleton className="h-2 w-full rounded-full" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div className={cn("flex min-h-44 flex-col gap-3", className)} aria-hidden="true">
      <div className="flex flex-1 items-end gap-1.5">
        {Array.from({ length: Math.max(1, points) }, (_, index) => (
          <NSkeleton
            className={cn("min-h-2 flex-1", variant === "bar" ? "rounded-t-sm" : "rounded-full")}
            key={index}
            style={{ height: `${32 + ((index * 17) % 58)}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between gap-2">
        {Array.from({ length: Math.min(6, Math.max(1, points)) }, (_, index) => (
          <NSkeleton className="h-3 w-6" key={index} />
        ))}
      </div>
    </div>
  );
}

function chartMaximum(data: readonly NChartDatum[], series: readonly NChartSeries[]) {
  return Math.max(1, ...data.flatMap((point) => series.map((item) => numberValue(point.values[item.id]))));
}

export function NBarChart({
  ariaLabel,
  className,
  data,
  emptyLabel,
  height = 176,
  icon,
  iconColor,
  loading,
  loadingLabel,
  series,
  showLegend = true,
  title,
  valueFormatter = String,
}: NBarChartProps) {
  if (loading) return <LoadingCard className={className} icon={icon} iconColor={iconColor} label={loadingLabel} title={title} variant="bar" />;
  const maximum = chartMaximum(data, series);
  return (
    <NCard className={cn("h-full min-w-0 overflow-hidden", className)} icon={icon} iconColor={iconColor} title={title}>
      {showLegend ? <ChartLegend series={series} /> : null}
      {!data.length || !series.length ? <EmptyChart>{emptyLabel}</EmptyChart> : (
        <div aria-label={accessibleLabel(title, ariaLabel)} role="img">
          <div
            className="grid min-w-0 items-end gap-0.5 border-b border-border/80 px-0.5 pt-3 sm:gap-2 sm:px-1"
            style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))`, height }}
          >
            {data.map((point) => (
              <div className="flex h-full min-w-0 flex-col justify-end gap-2" key={point.id}>
                <div className="flex min-w-0 flex-1 items-end justify-center gap-px sm:gap-1">
                  {series.map((item, index) => {
                    const value = numberValue(point.values[item.id]);
                    return (
                      <div
                        aria-label={`${String(item.label)}: ${String(valueFormatter(value))}`}
                        className="min-w-px w-full max-w-4 rounded-t-sm transition-opacity hover:opacity-80 focus-visible:opacity-80 sm:rounded-t-md"
                        key={item.id}
                        style={{ backgroundColor: getNChartColor(index, item.color), height: value === 0 ? 3 : Math.max(8, Math.round((value / maximum) * (height - 26))) }}
                        tabIndex={0}
                      />
                    );
                  })}
                </div>
                <span className="truncate text-center text-[8px] leading-none text-muted-foreground sm:text-[10px]">{point.label}</span>
              </div>
            ))}
          </div>
          <span className="sr-only">{chartSummary(data, series, valueFormatter)}</span>
        </div>
      )}
    </NCard>
  );
}

function lineCoordinate(index: number, count: number, value: number, maximum: number) {
  return { x: count <= 1 ? 50 : 2 + (index / (count - 1)) * 96, y: 96 - (value / maximum) * 88 };
}

function smoothLinePath(points: Array<{ x: number; y: number }>) {
  if (!points.length) return "";
  if (points.length === 1) return `M ${points[0].x} ${points[0].y}`;
  return points.slice(1).reduce((path, point, index) => {
    const previous = points[index];
    const midpointX = (previous.x + point.x) / 2;
    return `${path} C ${midpointX} ${previous.y}, ${midpointX} ${point.y}, ${point.x} ${point.y}`;
  }, `M ${points[0].x} ${points[0].y}`);
}

export function NLineChart(props: NLineChartProps) {
  const {
    ariaLabel, className, data, emptyLabel, height = 176, icon, iconColor,
    loading, loadingLabel, series, showLegend = true, title, valueFormatter = String,
  } = props;
  if (loading) return <LoadingCard className={className} icon={icon} iconColor={iconColor} label={loadingLabel} title={title} variant="line" />;
  const maximum = chartMaximum(data, series);
  return (
    <NCard className={cn("h-full min-w-0 overflow-hidden", className)} icon={icon} iconColor={iconColor} title={title}>
      {showLegend ? <ChartLegend series={series} /> : null}
      {!data.length || !series.length ? <EmptyChart>{emptyLabel}</EmptyChart> : (
        <div aria-label={accessibleLabel(title, ariaLabel)} className="min-w-0 overflow-hidden pb-1" role="img">
          <div className="relative w-full min-w-0" style={{ height }}>
            <svg aria-hidden="true" className="absolute inset-0 size-full" preserveAspectRatio="none" viewBox="0 0 100 100">
              {series.map((item, index) => (
                <path
                  d={smoothLinePath(data.map((point, pointIndex) => lineCoordinate(pointIndex, data.length, numberValue(point.values[item.id]), maximum)))}
                  fill="none"
                  key={item.id}
                  stroke={getNChartColor(index, item.color)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="3"
                  vectorEffect="non-scaling-stroke"
                />
              ))}
            </svg>
          </div>
          <div className="grid px-1 pt-2" style={{ gridTemplateColumns: `repeat(${data.length}, minmax(0, 1fr))` }}>
            {data.map((point) => <span className="truncate text-center text-[10px] text-muted-foreground" key={point.id}>{point.label}</span>)}
          </div>
          <span className="sr-only">{chartSummary(data, series, valueFormatter)}</span>
        </div>
      )}
    </NCard>
  );
}

function chartSummary(data: readonly NChartDatum[], series: readonly NChartSeries[], formatter: (value: number) => React.ReactNode) {
  return data.flatMap((point) => series.map((item) => `${String(point.label)} · ${String(item.label)}: ${String(formatter(numberValue(point.values[item.id])))}`)).join("; ");
}

function piePoint(angle: number, radius: number) {
  const radians = (angle * Math.PI) / 180;
  return { x: 50 + Math.cos(radians) * radius, y: 50 + Math.sin(radians) * radius };
}

function piePath(startAngle: number, endAngle: number) {
  const radius = 47;
  if (endAngle - startAngle >= 359.999) return `M 50 3 a ${radius} ${radius} 0 1 1 0 ${radius * 2} a ${radius} ${radius} 0 1 1 0 -${radius * 2}`;
  const start = piePoint(startAngle, radius);
  const end = piePoint(endAngle, radius);
  return `M 50 50 L ${start.x} ${start.y} A ${radius} ${radius} 0 ${endAngle - startAngle > 180 ? 1 : 0} 1 ${end.x} ${end.y} Z`;
}

export function NPieChart({
  ariaLabel, className, emptyLabel, icon, iconColor, items, loading, loadingLabel,
  percentageFormatter, showLegend = true, size, title, valueFormatter = String,
}: NPieChartProps) {
  if (loading) return <LoadingCard className={className} icon={icon} iconColor={iconColor} label={loadingLabel} title={title} variant="pie" />;
  const normalized = items.map((item, index) => ({ ...item, value: numberValue(item.value), color: getNChartColor(index, item.color) }));
  const total = normalized.reduce((sum, item) => sum + item.value, 0);
  let angle = -90;
  const slices = normalized.flatMap((item) => {
    if (!item.value || !total) return [];
    const start = angle;
    angle += (item.value / total) * 360;
    return [{ ...item, path: piePath(start, angle), ratio: item.value / total }];
  });
  const diameter = chartSize(size);
  return (
    <NCard className={cn("h-full min-w-0", className)} icon={icon} iconColor={iconColor} title={title}>
      {!total ? <EmptyChart>{emptyLabel}</EmptyChart> : (
        <div className="flex min-w-0 items-center gap-4 sm:flex-col sm:gap-5" role="img" aria-label={accessibleLabel(title, ariaLabel)}>
          <svg className="h-auto max-w-full shrink" style={{ width: diameter, maxWidth: "100%" }} viewBox="0 0 100 100" aria-hidden="true">
            {slices.map((slice) => <path d={slice.path} fill={slice.color} key={slice.id} stroke="var(--card)" strokeWidth="1" />)}
          </svg>
          {showLegend ? (
            <div className="min-w-0 flex-1 space-y-3 sm:w-full sm:flex-none" data-slot="chart-legend">
              {normalized.map((item) => (
                <div className="flex items-center justify-between gap-3 text-sm" key={item.id}>
                  <span className="flex min-w-0 items-center gap-2 text-muted-foreground"><span className="size-2.5 shrink-0 rounded-full" style={{ backgroundColor: item.color }} aria-hidden="true" /><span className="truncate">{item.label}</span></span>
                  <strong className="shrink-0 tabular-nums">{valueFormatter(item.value)}{percentageFormatter ? <span className="ms-1 font-normal text-muted-foreground">{percentageFormatter(total ? item.value / total : 0)}</span> : null}</strong>
                </div>
              ))}
            </div>
          ) : null}
          <span className="sr-only">{normalized.map((item) => `${String(item.label)}: ${String(valueFormatter(item.value))}`).join("; ")}</span>
        </div>
      )}
    </NCard>
  );
}

export function NStatusBreakdown({
  ariaLabel, className, emptyLabel, icon, iconColor, items, loading, loadingLabel,
  minimumVisiblePercent = 4, title, valueFormatter = String,
}: NStatusBreakdownProps) {
  if (loading) return <LoadingCard className={className} icon={icon} iconColor={iconColor} label={loadingLabel} title={title} variant="status" />;
  const maximum = Math.max(1, ...items.map((item) => numberValue(item.value)));
  return (
    <NCard className={cn("h-full", className)} icon={icon} iconColor={iconColor} title={title}>
      {!items.length ? <EmptyChart>{emptyLabel}</EmptyChart> : (
        <div aria-label={accessibleLabel(title, ariaLabel)} className="space-y-3" role="img">
          {items.map((item, index) => {
            const value = numberValue(item.value);
            return (
              <div className={cn("space-y-1.5", item.className)} key={item.id}>
                <div className="flex items-center justify-between gap-3 text-sm"><span className="text-muted-foreground">{item.label}</span><strong className="tabular-nums">{valueFormatter(value)}</strong></div>
                <div className="h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full" style={{ backgroundColor: getNChartColor(index, item.color), width: `${Math.max(minimumVisiblePercent, (value / maximum) * 100)}%` }} /></div>
              </div>
            );
          })}
        </div>
      )}
    </NCard>
  );
}
