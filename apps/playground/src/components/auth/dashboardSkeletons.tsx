import { Skeleton } from '@/components/ui/skeleton';

export function DashboardContentSkeleton() {
  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-5">
            <Skeleton className="mb-3 h-3 w-14" />
            <Skeleton className="h-5 w-28" />
          </div>
        ))}
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-lg border border-border bg-card p-6">
          <Skeleton className="mb-1 h-4 w-20" />
          <Skeleton className="mb-4 h-3 w-48" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-lg border border-border px-4 py-3">
                <Skeleton className="mb-1 h-3.5 w-16" />
                <Skeleton className="h-3 w-32" />
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-lg border border-border bg-gray-900 p-6">
          <Skeleton className="mb-1 h-4 w-24 bg-white/15" />
          <Skeleton className="mb-4 h-3 w-48 bg-white/10" />
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="rounded-md bg-white/5 px-3 py-2">
                <Skeleton className="h-3 w-full bg-white/10" />
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function OverviewSkeleton() {
  return <DashboardContentSkeleton />;
}

export function ActivitySkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_320px]">
      <div className="rounded-lg border border-border bg-card">
        <div className="border-b border-border px-6 py-4">
          <Skeleton className="mb-0.5 h-4 w-16" />
          <Skeleton className="h-3 w-40" />
        </div>
        <div className="divide-y divide-border">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-start gap-4 px-6 py-4">
              <Skeleton className="mt-1 h-2 w-2 rounded-full" />
              <div className="flex-1">
                <Skeleton className="mb-1 h-3.5 w-32" />
                <Skeleton className="h-3 w-full" />
              </div>
              <Skeleton className="h-3 w-12" />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-lg border border-border bg-card p-5">
        <Skeleton className="mb-4 h-4 w-28" />
        <div className="space-y-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="flex items-start gap-2">
              <Skeleton className="h-4 w-4 rounded" />
              <Skeleton className="h-3 w-full" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function AccountSkeleton() {
  return (
    <div className="rounded-lg border border-border bg-card p-6">
      <Skeleton className="mb-4 h-5 w-16" />
      <div className="mb-6 flex gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-9 w-20 rounded-md" />
        ))}
      </div>
      <div className="space-y-4">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i}>
            <Skeleton className="mb-2 h-4 w-24" />
            <Skeleton className="h-10 w-full rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}

export function SidebarUserSkeleton() {
  return (
    <div className="flex items-center gap-3 px-4 py-4">
      <Skeleton className="h-9 w-9 rounded-lg" />
      <div className="min-w-0">
        <Skeleton className="mb-1 h-3.5 w-20" />
        <Skeleton className="h-3 w-28" />
      </div>
    </div>
  );
}

export function SidebarStatsSkeleton() {
  return null;
}
