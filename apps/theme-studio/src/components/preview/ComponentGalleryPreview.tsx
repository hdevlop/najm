import {
  Button,
  Badge,
  NAlert,
  NProgress,
  NAvatar,
  NCard,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
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
            <Button>Default</Button>
            <Button variant="secondary">Secondary</Button>
            <Button variant="outline">Outline</Button>
            <Button variant="ghost">Ghost</Button>
            <Button variant="destructive">Destructive</Button>
            <Button disabled>Disabled</Button>
          </div>
        </SelectablePreviewElement>
      </Group>

      <Group title="Badges">
        <SelectablePreviewElement component="badge">
          <div className="flex flex-wrap gap-2">
            <Badge>Default</Badge>
            <Badge variant="secondary">Secondary</Badge>
            <Badge variant="success">Success</Badge>
            <Badge variant="warning">Warning</Badge>
            <Badge variant="destructive">Error</Badge>
            <Badge variant="outline">Outline</Badge>
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
          <Tabs defaultValue="t1">
            <TabsList>
              <TabsTrigger value="t1">Overview</TabsTrigger>
              <TabsTrigger value="t2">Activity</TabsTrigger>
              <TabsTrigger value="t3">Settings</TabsTrigger>
            </TabsList>
            <TabsContent value="t1" className="pt-2 text-sm text-muted-foreground">Overview content</TabsContent>
            <TabsContent value="t2" className="pt-2 text-sm text-muted-foreground">Activity content</TabsContent>
            <TabsContent value="t3" className="pt-2 text-sm text-muted-foreground">Settings content</TabsContent>
          </Tabs>
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
