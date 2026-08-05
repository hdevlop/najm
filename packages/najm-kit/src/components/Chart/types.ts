import type React from "react";
import type { NIconSource } from "../Icon";

export type NChartSize = "sm" | "md" | "lg" | number;

export interface NChartSeries {
  id: string;
  label: React.ReactNode;
  color?: string;
}

export interface NChartDatum {
  id: string;
  label: React.ReactNode;
  values: Readonly<Record<string, number>>;
}

export interface NChartItem {
  id: string;
  label: React.ReactNode;
  value: number;
  color?: string;
  className?: string;
}

export interface NChartCardProps {
  title: React.ReactNode;
  ariaLabel?: string;
  icon?: NIconSource;
  iconColor?: string;
  className?: string;
  emptyLabel?: React.ReactNode;
  loading?: boolean;
  loadingLabel?: string;
  valueFormatter?: (value: number) => React.ReactNode;
}

export interface NCartesianChartProps extends NChartCardProps {
  data: readonly NChartDatum[];
  series: readonly NChartSeries[];
  height?: number;
  showLegend?: boolean;
}

export type NBarChartProps = NCartesianChartProps;
export type NLineChartProps = NCartesianChartProps;

export interface NPieChartProps extends NChartCardProps {
  items: readonly NChartItem[];
  size?: NChartSize;
  showLegend?: boolean;
  percentageFormatter?: (ratio: number) => React.ReactNode;
}

export interface NStatusBreakdownProps extends NChartCardProps {
  items: readonly NChartItem[];
  minimumVisiblePercent?: number;
}

export type NChartSkeletonVariant = "bar" | "line" | "pie" | "status";

export interface NChartSkeletonProps {
  variant?: NChartSkeletonVariant;
  points?: number;
  rows?: number;
  className?: string;
}
