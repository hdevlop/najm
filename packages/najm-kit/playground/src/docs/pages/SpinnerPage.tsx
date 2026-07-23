import React from 'react';
import { NSpinner, NButton } from 'najm-kit';
import { ComponentPage } from '../ComponentPage';
import { Example } from '../Example';

const ALL_VARIANTS = [
  'default',
  'circle',
  'pinwheel',
  'circle-filled',
  'ellipsis',
  'ring',
  'bars',
] as const;

export function SpinnerPage() {
  return (
    <ComponentPage
      title="Spinner"
      description="Animated loading indicators in seven visual styles, multiple sizes, and custom colors."
      category="Feedback"
    >
      <Example
        title="Spinner variants"
        description="Seven built-in spinner variants for every visual style — from classic rotating icons to animated dots and pulsing rings."
        code={`import { NSpinner } from 'najm-kit';

<NSpinner variant="default" />
<NSpinner variant="circle" />
<NSpinner variant="pinwheel" />
<NSpinner variant="circle-filled" />
<NSpinner variant="ellipsis" />
<NSpinner variant="ring" />
<NSpinner variant="bars" />`}
      >
        {ALL_VARIANTS.map((v) => (
          <div key={v} className="flex flex-col items-center gap-2">
            <NSpinner variant={v} />
            <span className="text-[11px] text-muted-foreground">{v}</span>
          </div>
        ))}
      </Example>

      <Example
        title="Spinner sizes"
        description="Three named sizes plus arbitrary numeric values for full control."
        code={`<NSpinner variant="circle" size={16} />
<NSpinner variant="circle" size={20} />   {/* sm */}
<NSpinner variant="circle" size={24} />   {/* md */}
<NSpinner variant="circle" size={32} />   {/* lg */}
<NSpinner variant="circle" size={48} />`}
      >
        <NSpinner variant="circle" size={16} />
        <NSpinner variant="circle" size={20} />
        <NSpinner variant="circle" size={24} />
        <NSpinner variant="circle" size={32} />
        <NSpinner variant="circle" size={48} />
      </Example>

      <Example
        title="Colored spinners"
        description="Change the spinner color with a simple className — works for every variant."
        code={`<NSpinner variant="circle" className="text-violet-500" />
<NSpinner variant="circle" className="text-emerald-500" />
<NSpinner variant="circle" className="text-amber-500" />
<NSpinner variant="circle" className="text-red-500" />
<NSpinner variant="ring" className="text-violet-500" />
<NSpinner variant="bars" className="text-cyan-500" />
<NSpinner variant="ellipsis" className="text-orange-500" />
<NSpinner variant="pinwheel" className="text-pink-500" />`}
      >
        <NSpinner variant="circle" className="text-violet-500" />
        <NSpinner variant="circle" className="text-emerald-500" />
        <NSpinner variant="circle" className="text-amber-500" />
        <NSpinner variant="circle" className="text-red-500" />
        <NSpinner variant="ring" className="text-violet-500" />
        <NSpinner variant="bars" className="text-cyan-500" />
        <NSpinner variant="ellipsis" className="text-orange-500" />
        <NSpinner variant="pinwheel" className="text-pink-500" />
      </Example>

      <Example
        title="Spinner with label"
        description="Pair a spinner with text for explicit loading feedback."
        code={`<div className="flex items-center gap-2">
  <NSpinner variant="circle" size={16} />
  <span className="text-sm text-muted-foreground">Loading...</span>
</div>

<div className="flex items-center gap-2">
  <NSpinner variant="ellipsis" size={20} />
  <span className="text-sm text-muted-foreground">Saving changes</span>
</div>

<div className="flex items-center gap-2">
  <NSpinner variant="bars" size={18} className="text-emerald-500" />
  <span className="text-sm text-emerald-500">Processing payment</span>
</div>`}
      >
        <div className="flex items-center gap-2">
          <NSpinner variant="circle" size={16} />
          <span className="text-sm text-muted-foreground">Loading...</span>
        </div>
        <div className="flex items-center gap-2">
          <NSpinner variant="ellipsis" size={20} />
          <span className="text-sm text-muted-foreground">Saving changes</span>
        </div>
        <div className="flex items-center gap-2">
          <NSpinner variant="bars" size={18} className="text-emerald-500" />
          <span className="text-sm text-emerald-500">Processing payment</span>
        </div>
      </Example>

      <Example
        title="Spinner in a button"
        description="Disable the button and embed a spinner to signal an in-flight action."
        code={`<NButton disabled>
  <NSpinner variant="circle" size={16} /> Saving...
</NButton>

<NButton variant="outline" disabled>
  <NSpinner variant="circle" size={16} /> Loading
</NButton>

<NButton variant="secondary" disabled>
  <NSpinner variant="circle" size={16} className="text-emerald-400" />
  Processing
</NButton>`}
      >
        <NButton disabled>
          <NSpinner variant="circle" size={16} /> Saving...
        </NButton>
        <NButton variant="outline" disabled>
          <NSpinner variant="circle" size={16} /> Loading
        </NButton>
        <NButton variant="secondary" disabled>
          <NSpinner variant="circle" size={16} className="text-emerald-400" />
          Processing
        </NButton>
      </Example>

      <Example
        title="Inline spinner"
        description="Use small spinners inline inside text or badges to indicate real-time updates."
        code={`<p className="text-sm text-muted-foreground">
  Syncing data <NSpinner variant="circle" size={12} className="inline" />
</p>

<p className="text-sm">
  <span className="inline-flex items-center gap-1 text-amber-500">
    <NSpinner variant="ellipsis" size={14} className="inline" />
    Pending
  </span>
</p>`}
      >
        <p className="text-sm text-muted-foreground flex items-center gap-1">
          Syncing data <NSpinner variant="circle" size={12} />
        </p>
        <span className="inline-flex items-center gap-1 text-sm text-amber-500">
          <NSpinner variant="ellipsis" size={14} />
          Pending
        </span>
      </Example>

      <Example
        title="Overlay spinner"
        description="Layer a spinner over content to indicate background activity."
        center={false}
        code={`<div className="relative rounded-lg border p-6">
  <p className="text-sm">Your content here.</p>
  <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-lg">
    <NSpinner variant="circle" size={32} />
  </div>
</div>`}
      >
        <div className="relative rounded-lg border border-border p-6 w-full">
          <div className="space-y-2">
            <div className="h-3 w-3/4 rounded bg-muted" />
            <div className="h-3 w-1/2 rounded bg-muted" />
            <div className="h-3 w-2/3 rounded bg-muted" />
          </div>
          <div className="absolute inset-0 flex items-center justify-center bg-background/60 backdrop-blur-sm rounded-lg">
            <NSpinner variant="circle" size={32} />
          </div>
        </div>
      </Example>
    </ComponentPage>
  );
}
