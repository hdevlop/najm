import React from "react";
import { Button, NButton } from "najm-kit";
import { ComponentPage } from "../../ComponentPage";
import { Example } from "../../Example";

const variantMatrix = [
  "default",
  "secondary",
  "tertiary",
  "outline",
  "ghost",
  "soft",
  "subtle",
  "plain",
  "success",
  "warning",
  "info",
  "destructive",
] as const;

const sizeMatrix = ["2xs", "xs", "sm", "default", "lg", "xl", "2xl"] as const;
const roundedMatrix = ["none", "sm", "default", "lg", "xl", "2xl", "full"] as const;

export { variantMatrix, sizeMatrix, roundedMatrix };

export function VariantsExample() {
  return (
    <Example
      title="Variants"
      description="Use named variants instead of hand-written color classes."
      previewHeight="h-80"
      code={`<NButton variant="default">Default</NButton>
<NButton variant="secondary">Secondary</NButton>
<NButton variant="tertiary">Tertiary</NButton>
<NButton variant="outline">Outline</NButton>
<NButton variant="ghost">Ghost</NButton>
<NButton variant="soft">Soft</NButton>
<NButton variant="subtle">Subtle</NButton>
<NButton variant="plain">Plain</NButton>
<NButton variant="success">Success</NButton>
<NButton variant="warning">Warning</NButton>
<NButton variant="info">Info</NButton>
<NButton variant="destructive">Destructive</NButton>`}
    >
      {variantMatrix.map((variant) => (
        <NButton key={variant} variant={variant}>
          {variant}
        </NButton>
      ))}
    </Example>
  );
}

export function OutlineMultiColorExample() {
  return (
    <Example
      title="Outline multi-color"
      description="Combine the outline variant with color utilities for semantic outlined buttons."
      previewHeight="h-56"
      code={`<NButton variant="outline" className="border-primary/50 text-primary hover:bg-primary/10">
  Primary
</NButton>
<NButton variant="outline" className="border-emerald-500/50 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400">
  Success
</NButton>
<NButton variant="outline" className="border-amber-500/50 text-amber-600 hover:bg-amber-500/10 dark:text-amber-400">
  Warning
</NButton>
<NButton variant="outline" className="border-sky-500/50 text-sky-600 hover:bg-sky-500/10 dark:text-sky-400">
  Info
</NButton>
<NButton variant="outline" className="border-destructive/50 text-destructive hover:bg-destructive/10">
  Destructive
</NButton>`}
    >
      <div className="flex flex-wrap items-center justify-center gap-3">
        <NButton variant="outline" className="border-primary/50 text-primary hover:bg-primary/10">
          Primary
        </NButton>
        <NButton variant="outline" className="border-emerald-500/50 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400">
          Success
        </NButton>
        <NButton variant="outline" className="border-amber-500/50 text-amber-600 hover:bg-amber-500/10 dark:text-amber-400">
          Warning
        </NButton>
        <NButton variant="outline" className="border-sky-500/50 text-sky-600 hover:bg-sky-500/10 dark:text-sky-400">
          Info
        </NButton>
        <NButton variant="outline" className="border-destructive/50 text-destructive hover:bg-destructive/10">
          Destructive
        </NButton>
      </div>
    </Example>
  );
}

export function DashedExample() {
  return (
    <Example
      title="Dashed"
      description="Use the outline variant with border-dashed for a lightweight, dashed-border style."
      previewHeight="h-56"
      code={`<NButton variant="outline" className="border-dashed border-primary/50 text-primary hover:bg-primary/10">
  Default
</NButton>
<NButton variant="outline" className="border-dashed border-emerald-500/50 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400">
  Success
</NButton>
<NButton variant="outline" className="border-dashed border-amber-500/50 text-amber-600 hover:bg-amber-500/10 dark:text-amber-400">
  Warning
</NButton>
<NButton variant="outline" className="border-dashed border-sky-500/50 text-sky-600 hover:bg-sky-500/10 dark:text-sky-400">
  Info
</NButton>
<NButton variant="outline" className="border-dashed border-destructive/50 text-destructive hover:bg-destructive/10">
  Destructive
</NButton>`}
    >
      <div className="flex flex-wrap items-center justify-center gap-3">
        <NButton variant="outline" className="border-dashed border-primary/50 text-primary hover:bg-primary/10">
          Default
        </NButton>
        <NButton variant="outline" className="border-dashed border-emerald-500/50 text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400">
          Success
        </NButton>
        <NButton variant="outline" className="border-dashed border-amber-500/50 text-amber-600 hover:bg-amber-500/10 dark:text-amber-400">
          Warning
        </NButton>
        <NButton variant="outline" className="border-dashed border-sky-500/50 text-sky-600 hover:bg-sky-500/10 dark:text-sky-400">
          Info
        </NButton>
        <NButton variant="outline" className="border-dashed border-destructive/50 text-destructive hover:bg-destructive/10">
          Destructive
        </NButton>
      </div>
    </Example>
  );
}

export function SizesExample() {
  return (
    <Example
      title="Sizes"
      description="Button density scales from compact toolbars to primary page actions."
      code={`<NButton size="2xs">2xs</NButton>
<NButton size="xs">xs</NButton>
<NButton size="sm">sm</NButton>
<NButton size="default">default</NButton>
<NButton size="lg">lg</NButton>
<NButton size="xl">xl</NButton>
<NButton size="2xl">2xl</NButton>`}
    >
      <div className="flex flex-wrap items-center justify-center gap-3">
        {sizeMatrix.map((size) => (
          <NButton key={size} size={size}>
            {size}
          </NButton>
        ))}
      </div>
    </Example>
  );
}

export function RoundedExample() {
  return (
    <Example
      title="Rounded"
      description="Radius is a first-class prop, so shape stays consistent across sizes."
      code={`<NButton rounded="none">none</NButton>
<NButton rounded="sm">sm</NButton>
<NButton rounded="default">default</NButton>
<NButton rounded="lg">lg</NButton>
<NButton rounded="xl">xl</NButton>
<NButton rounded="2xl">2xl</NButton>
<NButton rounded="full">full</NButton>`}
    >
      {roundedMatrix.map((rounded) => (
        <NButton key={rounded} rounded={rounded} variant="outline">
          {rounded}
        </NButton>
      ))}
    </Example>
  );
}

export function IconsExample() {
  return (
    <Example
      title="Icons"
      description="Use lucide names as strings for the fastest path, or pass a component/element when you need a custom icon."
      code={`<NButton leftIcon="plus">Create</NButton>
<NButton variant="secondary" leftIcon="download">Export</NButton>
<NButton variant="outline" rightIcon="arrow-right">Continue</NButton>
<NButton variant="ghost" leftIcon="heart">Favorite</NButton>`}
    >
      <NButton leftIcon="plus">Create</NButton>
      <NButton variant="secondary" leftIcon="download">
        Export
      </NButton>
      <NButton variant="outline" rightIcon="arrow-right">
        Continue
      </NButton>
      <NButton variant="ghost" leftIcon="heart">
        Favorite
      </NButton>
    </Example>
  );
}

export function IconButtonsExample() {
  return (
    <Example
      title="Icon Buttons"
      description="Icon sizes cover compact controls without one-off width classes."
      code={`<NButton size="icon-xs" variant="outline" leftIcon="plus" aria-label="Add" />
<NButton size="icon-sm" variant="outline" leftIcon="heart" aria-label="Like" />
<NButton size="icon" leftIcon="settings" aria-label="Settings" />
<NButton size="icon-lg" rounded="full" variant="secondary" leftIcon="send" aria-label="Send" />
<NButton size="icon-xl" rounded="full" variant="success" leftIcon="check" aria-label="Done" />`}
    >
      <NButton size="icon-xs" variant="outline" leftIcon="plus" aria-label="Add" />
      <NButton size="icon-sm" variant="outline" leftIcon="heart" aria-label="Like" />
      <NButton size="icon" leftIcon="settings" aria-label="Settings" />
      <NButton size="icon-lg" rounded="full" variant="secondary" leftIcon="send" aria-label="Send" />
      <NButton size="icon-xl" rounded="full" variant="success" leftIcon="check" aria-label="Done" />
    </Example>
  );
}

export function LoadingExample() {
  return (
    <Example
      title="Loading"
      description="The loading prop disables the native button and swaps in loader text."
      code={`<NButton loading loadingText="Saving">Save changes</NButton>
<NButton loading loaderPosition="right" variant="outline">Sync</NButton>
<NButton loading loaderPosition="center" size="icon" aria-label="Loading" />`}
    >
      <NButton loading loadingText="Saving">
        Save changes
      </NButton>
      <NButton loading loaderPosition="right" variant="outline">
        Sync
      </NButton>
      <NButton loading loaderPosition="center" size="icon" aria-label="Loading" />
    </Example>
  );
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function AsyncButtonDemo() {
  return (
    <div className="flex flex-wrap items-center justify-center gap-3">
      <NButton
        leftIcon="save"
        loadingText="Saving"
        onClick={async () => {
          await wait(1200);
        }}
      >
        Save changes
      </NButton>

      <NButton
        variant="outline"
        loaderPosition="right"
        loadingText="Uploading"
        rightIcon="upload-cloud"
        onClick={async () => {
          await wait(1200);
        }}
      >
        Upload file
      </NButton>

      <NButton
        variant="destructive"
        loadingText="Deleting"
        leftIcon="trash-2"
        onClick={async () => {
          await wait(1200);
        }}
      >
        Delete record
      </NButton>
    </div>
  );
}

export function AsyncClickExample() {
  return (
    <Example
      title="Async click"
      description="Return a promise from onClick and the button manages the pending state."
      previewHeight="h-56"
      code={`<NButton
  leftIcon="save"
  loadingText="Saving"
  onClick={async () => {
    await saveChanges()
  }}
>
  Save changes
</NButton>`}
    >
      <AsyncButtonDemo />
    </Example>
  );
}

export function AsyncNoLockExample() {
  return (
    <Example
      title="Async without lock"
      description="Disable the loading lock when repeated actions are valid."
      code={`<NButton
  disabledWhileLoading={false}
  loadingText="Sending"
  rightIcon="send"
  onClick={async () => {
    await sendMessage()
  }}
>
  Send again
</NButton>`}
    >
      <NButton
        disabledWhileLoading={false}
        loadingText="Sending"
        rightIcon="send"
        onClick={async () => {
          await wait(1000);
        }}
      >
        Send again
      </NButton>
    </Example>
  );
}

function CheckoutPanel() {
  return (
    <div className="w-full max-w-sm rounded-xl border border-border bg-card p-5 shadow-sm">
      <div className="mb-5 space-y-1">
        <p className="text-sm font-medium text-foreground">Workspace plan</p>
        <p className="text-xs text-muted-foreground">42 seats, annual billing</p>
      </div>
      <div className="flex flex-col gap-2">
        <NButton fullWidth leftIcon="check" onClick={async () => wait(900)} loadingText="Confirming">
          Confirm upgrade
        </NButton>
        <NButton fullWidth variant="outline" leftIcon="mail">
          Send invoice
        </NButton>
        <NButton fullWidth variant="ghost" rightIcon="arrow-right">
          Review details
        </NButton>
      </div>
    </div>
  );
}

export function FullWidthExample() {
  return (
    <Example
      title="Full-width stack"
      description="fullWidth keeps action stacks readable without repeating w-full."
      center={false}
      previewHeight="h-80"
      code={`<NButton fullWidth leftIcon="check" loadingText="Confirming">
  Confirm upgrade
</NButton>
<NButton fullWidth variant="outline" leftIcon="mail">
  Send invoice
</NButton>
<NButton fullWidth variant="ghost" rightIcon="arrow-right">
  Review details
</NButton>`}
    >
      <div className="flex h-full items-center justify-center p-8">
        <CheckoutPanel />
      </div>
    </Example>
  );
}

export function AliasExample() {
  return (
    <Example
      title="Alias"
      description="Button and NButton share the same implementation."
      code={`import { Button, NButton } from "najm-kit"

<Button>Button</Button>
<NButton>NButton</NButton>`}
    >
      <Button>Button</Button>
      <NButton variant="outline">NButton</NButton>
    </Example>
  );
}
