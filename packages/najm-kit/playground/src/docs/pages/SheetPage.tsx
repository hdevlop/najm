import React, { useState } from "react";
import { Settings } from "lucide-react";
import { NButton, NSheet } from "najm-kit";

import { ComponentPage } from "../ComponentPage";
import { Example } from "../Example";

export function SheetPage() {
  const [open, setOpen] = useState(false);

  return (
    <ComponentPage
      category="Overlays"
      description="A standardized sheet with a fixed header, scrollable body, and fixed footer."
      title="NSheet"
    >
      <Example
        code={`const [open, setOpen] = useState(false);

<NButton onClick={() => setOpen(true)}>Open sheet</NButton>

<NSheet
  open={open}
  onOpenChange={setOpen}
  icon={Settings}
  title="Settings"
  description="Configure this example step by step."
  footer={<NButton onClick={() => setOpen(false)}>Done</NButton>}
>
  <p>Sheet body</p>
</NSheet>`}
        description="The base NSheet spacing contract without consumer overrides."
        title="Base sheet"
      >
        <NButton className="gap-2" onClick={() => setOpen(true)} variant="outline">
          <Settings className="size-4" />
          Open sheet
        </NButton>

        <NSheet
          description="Configure this example step by step."
          footer={
            <NButton className="w-full" onClick={() => setOpen(false)}>
              Done
            </NButton>
          }
          icon={Settings}
          onOpenChange={setOpen}
          open={open}
          title="Settings"
        >
          <p className="text-sm text-muted-foreground">Sheet body</p>
        </NSheet>
      </Example>
    </ComponentPage>
  );
}
