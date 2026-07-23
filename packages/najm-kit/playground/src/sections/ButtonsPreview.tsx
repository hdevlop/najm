import React from "react";
import { NButton } from "najm-kit";

export default function ButtonsPreview() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Buttons</h2>
      <div className="flex flex-wrap gap-3">
        <NButton variant="default">Default</NButton>
        <NButton variant="secondary">Secondary</NButton>
        <NButton variant="soft">Soft</NButton>
        <NButton variant="success">Success</NButton>
        <NButton variant="warning">Warning</NButton>
        <NButton variant="info">Info</NButton>
        <NButton variant="destructive">Destructive</NButton>
        <NButton variant="outline">Outline</NButton>
        <NButton variant="ghost">Ghost</NButton>
      </div>
      <h3 className="text-md font-medium mt-4">Sizes</h3>
      <div className="flex flex-wrap gap-3 items-center">
        <NButton size="xs">Extra small</NButton>
        <NButton size="sm">Small</NButton>
        <NButton size="default">Default</NButton>
        <NButton size="lg">Large</NButton>
        <NButton size="xl">Extra large</NButton>
        <NButton size="icon" leftIcon="settings" aria-label="Settings" />
      </div>
      <h3 className="text-md font-medium mt-4">DX helpers</h3>
      <div className="flex flex-wrap gap-3 items-center">
        <NButton rounded="full" leftIcon="save">
          Save
        </NButton>
        <NButton variant="outline" rightIcon="arrow-right">
          Continue
        </NButton>
        <NButton loading loadingText="Saving">
          Save changes
        </NButton>
        <NButton variant="success" leftIcon="check">
          Done
        </NButton>
      </div>
    </div>
  );
}
