import React from 'react';
import { cn } from "../../lib/cn";

interface SkeletonProps extends React.ComponentProps<"div"> {}

export function NSkeleton({ className, ...props }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-accent motion-reduce:animate-none', className)}
      aria-hidden="true"
      {...props}
    />
  );
}

export { NSkeleton as Skeleton };

export function NStatCardSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-4 flex items-start gap-3">
      <NSkeleton className="w-9 h-9 rounded-lg shrink-0" />
      <div className="min-w-0 flex-1">
        <NSkeleton className="h-3 w-16 mb-2" />
        <NSkeleton className="h-6 w-12 mb-1" />
        <NSkeleton className="h-3 w-20" />
      </div>
    </div>
  );
}

export function NTableRowSkeleton({ columns = 4 }: { columns?: number }) {
  return (
    <div role="row" className="flex items-center gap-4 px-4 py-3 border-b border-border">
      {Array.from({ length: columns }).map((_, i) => (
        <div key={i} role="cell" className="flex-1">
          <NSkeleton className="h-4 w-full" />
        </div>
      ))}
    </div>
  );
}

export function NTableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <>
      {Array.from({ length: rows }).map((_, i) => (
        <NTableRowSkeleton key={i} columns={columns} />
      ))}
    </>
  );
}

const BAR_HEIGHTS = [45, 62, 50, 72, 55, 78, 48, 68, 42, 70, 52, 65];

export function NSkeletonChart() {
  return (
    <div className="flex flex-col h-full w-full gap-2">
      <div className="flex items-end gap-1.5 flex-1">
        {BAR_HEIGHTS.map((height, i) => (
          <NSkeleton
            key={i}
            className="flex-1 rounded-t-sm min-h-2"
            style={{ height: `${height}%` }}
          />
        ))}
      </div>
      <div className="flex justify-between px-1 pb-1">
        {Array.from({ length: 6 }).map((_, i) => (
          <NSkeleton key={i} className="h-3 w-6" />
        ))}
      </div>
    </div>
  );
}

export function NSkeletonDonut() {
  return (
    <div className="flex flex-col items-center justify-center gap-4 h-full w-full py-4">
      <NSkeleton className="w-36 h-36 rounded-full" />
      <div className="flex gap-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <NSkeleton key={i} className="h-4 w-14" />
        ))}
      </div>
    </div>
  );
}

const WEEKDAY_COUNT = 7;
const CALENDAR_ROWS = 6;

export function NSkeletonCalendar() {
  return (
    <div className="w-full h-full flex flex-col gap-3">
      <div className="grid grid-cols-7 gap-1.5">
        {Array.from({ length: WEEKDAY_COUNT }).map((_, i) => (
          <NSkeleton key={`header-${i}`} className="h-4 w-full rounded-sm" />
        ))}
      </div>
      <div className="grid grid-cols-7 gap-1.5 flex-1">
        {Array.from({ length: WEEKDAY_COUNT * CALENDAR_ROWS }).map((_, i) => (
          <NSkeleton key={`day-${i}`} className="h-8 w-full rounded-sm" />
        ))}
      </div>
    </div>
  );
}

export function NSkeletonEventList({ count = 4 }: { count?: number }) {
  return (
    <div className="flex flex-col justify-between h-full gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <div key={i} className="flex gap-2 p-2">
          <div className="flex flex-col items-center min-w-[50px] gap-1">
            <NSkeleton className="h-4 w-full rounded-t" />
            <NSkeleton className="h-6 w-full rounded-b" />
          </div>
          <div className="flex-1 flex flex-col gap-2 pt-1">
            <NSkeleton className="h-4 w-3/4" />
            <NSkeleton className="h-3 w-1/2" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function NSkeletonWidget() {
  return (
    <div className="rounded-lg border border-border bg-card flex flex-row p-4 gap-4 w-full items-center justify-between">
      <NSkeleton className="w-12 h-12 rounded-lg shrink-0" />
      <div className="flex flex-col items-center gap-2 flex-1">
        <NSkeleton className="h-4 w-20" />
        <NSkeleton className="h-6 w-12" />
      </div>
    </div>
  );
}

export function NSkeletonWidgets({ count = 5 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3">
      {Array.from({ length: count }).map((_, i) => (
        <NSkeletonWidget key={i} />
      ))}
    </div>
  );
}
