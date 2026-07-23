import {
  NButton,
  NBadge,
  NAlert,
  NProgress,
  NAvatar,
  NCard,
  NTabs,
  SegmentedControl,
  NSpinner,
  NEmptyState,
} from "najm-kit";
import { useState } from "react";
import { SelectablePreviewElement } from "../SelectablePreviewElement";

function Group({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-sm font-semibold text-muted-foreground">{title}</h3>
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

export function ComponentGalleryPreview() {
  const [seg, setSeg] = useState("a");
  return (
    <div className="flex flex-col" style={{ gap: "var(--section-gap)" }}>
      <Group title="Buttons">
        <SelectablePreviewElement component="button">
          <div className="flex flex-wrap gap-2">
            <NButton>Default</NButton>
            <NButton variant="secondary">Secondary</NButton>
            <NButton variant="outline">Outline</NButton>
            <NButton variant="ghost">Ghost</NButton>
            <NButton variant="destructive">Destructive</NButton>
            <NButton disabled>Disabled</NButton>
          </div>
        </SelectablePreviewElement>
      </Group>

      <Group title="Badges">
        <SelectablePreviewElement component="badge">
          <div className="flex flex-wrap gap-2">
            <NBadge>Default</NBadge>
            <NBadge variant="secondary">Secondary</NBadge>
            <NBadge variant="success">Success</NBadge>
            <NBadge variant="warning">Warning</NBadge>
            <NBadge variant="destructive">Error</NBadge>
            <NBadge variant="outline">Outline</NBadge>
          </div>
        </SelectablePreviewElement>
      </Group>

      <Group title="Alerts">
        <div className="flex w-full flex-col gap-2">
          <SelectablePreviewElement component="alert">
            <NAlert variant="success" title="Saved" description="Your changes were saved." />
          </SelectablePreviewElement>
          <SelectablePreviewElement component="alert">
            <NAlert variant="warning" title="Heads up" description="Quota almost reached." />
          </SelectablePreviewElement>
        </div>
      </Group>

      <Group title="Tabs">
        <SelectablePreviewElement component="tabs" className="w-full">
          <NTabs
            defaultValue="t1"
            items={[
              {
                value: "t1",
                label: "Overview",
                content: <div className="pt-2 text-sm text-muted-foreground">Overview content</div>,
              },
              {
                value: "t2",
                label: "Activity",
                content: <div className="pt-2 text-sm text-muted-foreground">Activity content</div>,
              },
              {
                value: "t3",
                label: "Settings",
                content: <div className="pt-2 text-sm text-muted-foreground">Settings content</div>,
              },
            ]}
          />
        </SelectablePreviewElement>
      </Group>

      <Group title="Data & feedback">
        <SelectablePreviewElement component="avatar">
          <NAvatar fallback="SI" />
        </SelectablePreviewElement>
        <SelectablePreviewElement component="progress" className="w-48">
          <NProgress value={64} />
        </SelectablePreviewElement>
        <NSpinner />
        <SegmentedControl
          value={seg}
          onChange={setSeg}
          options={[
            { value: "a", label: "Day" },
            { value: "b", label: "Week" },
            { value: "c", label: "Month" },
          ]}
        />
      </Group>

      <SelectablePreviewElement component="card">
        <NCard title="Empty state example">
          <NEmptyState title="No results" description="Try adjusting your filters." />
        </NCard>
      </SelectablePreviewElement>
    </div>
  );
}
