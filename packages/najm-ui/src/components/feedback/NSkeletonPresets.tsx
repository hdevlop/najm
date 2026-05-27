import React from 'react';
import { cn } from "../../lib/cn";

interface SkeletonProps {
  className?: string;
}

export function NSkeleton({ className }: SkeletonProps) {
  return (
    <div
      className={cn('animate-pulse rounded-md bg-accent', className)}
      aria-hidden="true"
    />
  );
}

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