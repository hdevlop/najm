import React from 'react';
import { NSkeleton, NStatCardSkeleton, NTableSkeleton } from 'najm-kit';
import { ComponentPage } from '../ComponentPage';
import { Example } from '../Example';

export function SkeletonPage() {
  return (
    <ComponentPage
      title="Skeleton"
      description="Animated placeholder shapes that preserve layout while content loads. Use them to avoid visual jumps and improve perceived performance."
      category="Feedback"
    >
      <Example
        title="Basic text lines"
        description="The simplest skeleton — animated bars for text content. Adjust width and height via className."
        center={false}
        code={`import { NSkeleton } from 'najm-kit';

<NSkeleton className="h-4 w-[280px]" />
<NSkeleton className="h-4 w-[220px]" />
<NSkeleton className="h-4 w-[200px]" />
<NSkeleton className="h-3 w-[160px]" />`}
      >
        <div className="w-full space-y-2">
          <NSkeleton className="h-4 w-[280px]" />
          <NSkeleton className="h-4 w-[220px]" />
          <NSkeleton className="h-4 w-[200px]" />
          <NSkeleton className="h-3 w-[160px]" />
        </div>
      </Example>

      <Example
        title="Avatar and text"
        description="Combine a circular skeleton with text lines to mock a user row."
        center={false}
        code={`<div className="flex items-center gap-3">
  <NSkeleton className="h-10 w-10 rounded-full shrink-0" />
  <div className="space-y-2 flex-1">
    <NSkeleton className="h-4 w-32" />
    <NSkeleton className="h-3 w-24" />
  </div>
</div>

<div className="flex items-center gap-3">
  <NSkeleton className="h-8 w-8 rounded-full shrink-0" />
  <div className="space-y-2 flex-1">
    <NSkeleton className="h-3 w-28" />
    <NSkeleton className="h-3 w-20" />
  </div>
</div>`}
      >
        <div className="w-full space-y-4">
          <div className="flex items-center gap-3">
            <NSkeleton className="h-10 w-10 rounded-full shrink-0" />
            <div className="space-y-2 flex-1">
              <NSkeleton className="h-4 w-32" />
              <NSkeleton className="h-3 w-24" />
            </div>
          </div>
          <div className="flex items-center gap-3">
            <NSkeleton className="h-8 w-8 rounded-full shrink-0" />
            <div className="space-y-2 flex-1">
              <NSkeleton className="h-3 w-28" />
              <NSkeleton className="h-3 w-20" />
            </div>
          </div>
        </div>
      </Example>

      <Example
        title="Card skeleton"
        description="Build a card skeleton with an image header, title, description, and action buttons."
        center={false}
        code={`<div className="rounded-xl border border-border overflow-hidden max-w-[280px]">
  <NSkeleton className="h-36 w-full rounded-none" />
  <div className="p-4 space-y-3">
    <NSkeleton className="h-5 w-3/4" />
    <NSkeleton className="h-3 w-full" />
    <NSkeleton className="h-3 w-5/6" />
    <div className="flex gap-2 pt-2">
      <NSkeleton className="h-8 w-20 rounded-md" />
      <NSkeleton className="h-8 w-20 rounded-md" />
    </div>
  </div>
</div>`}
      >
        <div className="w-full flex justify-center">
          <div className="rounded-xl border border-border overflow-hidden max-w-[280px]">
            <NSkeleton className="h-36 w-full rounded-none" />
            <div className="p-4 space-y-3">
              <NSkeleton className="h-5 w-3/4" />
              <NSkeleton className="h-3 w-full" />
              <NSkeleton className="h-3 w-5/6" />
              <div className="flex gap-2 pt-2">
                <NSkeleton className="h-8 w-20 rounded-md" />
                <NSkeleton className="h-8 w-20 rounded-md" />
              </div>
            </div>
          </div>
        </div>
      </Example>

      <Example
        title="Stat card skeleton"
        description="Pre-built skeleton for stat/metric cards with an icon, value, and trend line."
        center={false}
        code={`import { NStatCardSkeleton } from 'najm-kit';

<NStatCardSkeleton />`}
      >
        <div className="w-full max-w-[240px]">
          <NStatCardSkeleton />
        </div>
      </Example>

      <Example
        title="Stat grid"
        description="Multiple stat card skeletons in a responsive grid."
        center={false}
        code={`<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
  <NStatCardSkeleton />
  <NStatCardSkeleton />
  <NStatCardSkeleton />
  <NStatCardSkeleton />
</div>`}
      >
        <div className="w-full grid grid-cols-2 gap-4">
          <NStatCardSkeleton />
          <NStatCardSkeleton />
          <NStatCardSkeleton />
          <NStatCardSkeleton />
        </div>
      </Example>

      <Example
        title="Table skeleton"
        description="Pre-built table skeleton with configurable rows and columns."
        center={false}
        code={`import { NTableSkeleton } from 'najm-kit';

<NTableSkeleton rows={5} columns={4} />
<NTableSkeleton rows={3} columns={3} />`}
      >
        <div className="w-full space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            5 rows, 4 columns
          </p>
          <NTableSkeleton rows={5} columns={4} />
        </div>
      </Example>

      <Example
        title="Profile card"
        description="Compose skeletons into a realistic profile card placeholder."
        center={false}
        code={`<div className="rounded-xl border border-border p-6 max-w-[320px] space-y-4">
  <div className="flex items-center gap-4">
    <NSkeleton className="h-14 w-14 rounded-full shrink-0" />
    <div className="space-y-2 flex-1">
      <NSkeleton className="h-5 w-32" />
      <NSkeleton className="h-3 w-24" />
    </div>
  </div>
  <div className="space-y-2">
    <NSkeleton className="h-3 w-full" />
    <NSkeleton className="h-3 w-5/6" />
    <NSkeleton className="h-3 w-4/6" />
  </div>
  <div className="grid grid-cols-3 gap-3 pt-2">
    <NSkeleton className="h-16 rounded-lg" />
    <NSkeleton className="h-16 rounded-lg" />
    <NSkeleton className="h-16 rounded-lg" />
  </div>
</div>`}
      >
        <div className="w-full flex justify-center">
          <div className="rounded-xl border border-border p-6 max-w-[320px] space-y-4">
            <div className="flex items-center gap-4">
              <NSkeleton className="h-14 w-14 rounded-full shrink-0" />
              <div className="space-y-2 flex-1">
                <NSkeleton className="h-5 w-32" />
                <NSkeleton className="h-3 w-24" />
              </div>
            </div>
            <div className="space-y-2">
              <NSkeleton className="h-3 w-full" />
              <NSkeleton className="h-3 w-5/6" />
              <NSkeleton className="h-3 w-4/6" />
            </div>
            <div className="grid grid-cols-3 gap-3 pt-2">
              <NSkeleton className="h-16 rounded-lg" />
              <NSkeleton className="h-16 rounded-lg" />
              <NSkeleton className="h-16 rounded-lg" />
            </div>
          </div>
        </div>
      </Example>

      <Example
        title="Form skeleton"
        description="Mimic a form layout with label/input skeleton pairs."
        center={false}
        code={`<div className="w-full max-w-md space-y-5">
  <div className="space-y-2">
    <NSkeleton className="h-3 w-16" />
    <NSkeleton className="h-9 w-full rounded-md" />
  </div>
  <div className="space-y-2">
    <NSkeleton className="h-3 w-20" />
    <NSkeleton className="h-9 w-full rounded-md" />
  </div>
  <div className="space-y-2">
    <NSkeleton className="h-3 w-12" />
    <NSkeleton className="h-24 w-full rounded-md" />
  </div>
  <div className="flex gap-3 pt-2">
    <NSkeleton className="h-9 w-24 rounded-md" />
    <NSkeleton className="h-9 w-24 rounded-md" />
  </div>
</div>`}
      >
        <div className="w-full flex justify-center">
          <div className="w-full max-w-md space-y-5">
            <div className="space-y-2">
              <NSkeleton className="h-3 w-16" />
              <NSkeleton className="h-9 w-full rounded-md" />
            </div>
            <div className="space-y-2">
              <NSkeleton className="h-3 w-20" />
              <NSkeleton className="h-9 w-full rounded-md" />
            </div>
            <div className="space-y-2">
              <NSkeleton className="h-3 w-12" />
              <NSkeleton className="h-24 w-full rounded-md" />
            </div>
            <div className="flex gap-3 pt-2">
              <NSkeleton className="h-9 w-24 rounded-md" />
              <NSkeleton className="h-9 w-24 rounded-md" />
            </div>
          </div>
        </div>
      </Example>

      <Example
        title="List items"
        description="Build repeating list-item skeletons for feeds, inboxes, or notifications."
        center={false}
        code={`<div className="w-full space-y-3">
  {[1, 2, 3].map((i) => (
    <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border">
      <NSkeleton className="h-10 w-10 rounded-full shrink-0" />
      <div className="flex-1 space-y-2">
        <NSkeleton className="h-4 w-3/4" />
        <NSkeleton className="h-3 w-1/2" />
      </div>
      <NSkeleton className="h-3 w-12 shrink-0" />
    </div>
  ))}
</div>`}
      >
        <div className="w-full space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-3 p-3 rounded-lg border border-border">
              <NSkeleton className="h-10 w-10 rounded-full shrink-0" />
              <div className="flex-1 space-y-2">
                <NSkeleton className="h-4 w-3/4" />
                <NSkeleton className="h-3 w-1/2" />
              </div>
              <NSkeleton className="h-3 w-12 shrink-0" />
            </div>
          ))}
        </div>
      </Example>

      <Example
        title="Dashboard grid"
        description="Combine stat cards, a table, and a chart placeholder in a dashboard layout."
        center={false}
        previewHeight="h-[420px]"
        code={`<div className="w-full space-y-4">
  <div className="grid grid-cols-2 gap-4">
    <NStatCardSkeleton />
    <NStatCardSkeleton />
  </div>
  <div className="space-y-2">
    <NSkeleton className="h-4 w-24" />
    <div className="rounded-xl border border-border p-4">
      <NSkeleton className="h-40 w-full rounded-lg" />
    </div>
  </div>
  <NTableSkeleton rows={3} columns={4} />
</div>`}
      >
        <div className="w-full space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <NStatCardSkeleton />
            <NStatCardSkeleton />
          </div>
          <div className="space-y-2">
            <NSkeleton className="h-4 w-24" />
            <div className="rounded-xl border border-border p-4">
              <NSkeleton className="h-40 w-full rounded-lg" />
            </div>
          </div>
          <NTableSkeleton rows={3} columns={4} />
        </div>
      </Example>
    </ComponentPage>
  );
}
