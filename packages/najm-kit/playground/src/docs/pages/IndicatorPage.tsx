import React from 'react';
import { Bell, ShoppingBag, X } from 'lucide-react';
import { NIndicator, Indicator, NCard, NAvatar, NButton, NBadge, TextInput } from 'najm-kit';
import { ComponentPage } from '../ComponentPage';
import { Example } from '../Example';

function BellBox({ children }: { children?: React.ReactNode }) {
  return (
    <div className="bg-pink-500/10 border border-pink-500/30 grid place-items-center rounded-md p-3">
      {children ?? <Bell size={20} className="text-pink-400" />}
    </div>
  );
}

function AvatarBox() {
  return (
    <div className="size-16 rounded-md bg-gradient-to-br from-pink-500/30 to-indigo-500/30 grid place-items-center text-2xl">
      J
    </div>
  );
}

const POSITIONS = [
  'top-start',
  'top-center',
  'top-end',
  'middle-start',
  'middle-center',
  'middle-end',
  'bottom-start',
  'bottom-center',
  'bottom-end',
] as const;

export function IndicatorPage() {
  return (
    <ComponentPage
      title="Indicator"
      description="Positioned dot, status, badge, or button that anchors to a corner of another element. Supports 9 corners, pulse/ping animations, color variants, and per-breakpoint responsive positioning."
      category="Data Display"
    >
      <Example
        title="Basic dot"
        description="Default overlay is a dot at the top-end corner."
        code={`<NIndicator>
  <BellBox />
</NIndicator>`}
      >
        <NIndicator>
          <BellBox />
        </NIndicator>
      </Example>

      <Example
        title="Status overlay"
        description="Use overlay='status' for a larger ringed dot."
        code={`<NIndicator overlay="status" color="success" position="top-end">
  <BellBox />
</NIndicator>`}
      >
        <NIndicator overlay="status" color="success" position="top-end">
          <BellBox />
        </NIndicator>
        <NIndicator overlay="status" color="info" position="top-end">
          <BellBox />
        </NIndicator>
        <NIndicator overlay="status" color="warning" position="top-end">
          <BellBox />
        </NIndicator>
        <NIndicator overlay="status" color="destructive" position="top-end">
          <BellBox />
        </NIndicator>
      </Example>

      <Example
        title="Badge overlay"
        description="Use overlay='badge' for a labelled counter."
        code={`<NIndicator overlay="badge" content="+99" color="primary" position="top-end">
  <BellBox />
</NIndicator>`}
      >
        <NIndicator overlay="badge" content="+99" color="primary" position="top-end">
          <BellBox />
        </NIndicator>
        <NIndicator overlay="badge" content="3" color="success" position="top-end">
          <BellBox />
        </NIndicator>
        <NIndicator overlay="badge" content="!" color="destructive" position="top-end">
          <BellBox />
        </NIndicator>
      </Example>

      <Example
        title="Pill badge overlay"
        description="Use shape='pill' for a fully rounded badge."
        code={`<NIndicator overlay="badge" shape="pill" content="+99" color="primary" position="top-end">
  <BellBox />
</NIndicator>`}
      >
        <NIndicator overlay="badge" shape="pill" content="+99" color="primary" position="top-end">
          <BellBox />
        </NIndicator>
        <NIndicator overlay="badge" shape="pill" content="typing…" color="info" position="bottom-end">
          <AvatarBox />
        </NIndicator>
      </Example>

      <Example
        title="Indicator on avatar"
        description="Wrap an avatar to show presence (badge, dot, or status)."
        code={`<NIndicator overlay="badge" content="typing…" color="primary" position="top-end">
  <AvatarBox />
</NIndicator>`}
      >
        <NIndicator overlay="badge" content="typing…" color="primary" position="top-end">
          <AvatarBox />
        </NIndicator>
        <NIndicator overlay="dot" color="primary" position="top-end">
          <AvatarBox />
        </NIndicator>
        <NIndicator overlay="status" color="primary" position="top-end">
          <AvatarBox />
        </NIndicator>
        <NIndicator overlay="status" color="success" position="top-end" ping>
          <AvatarBox />
        </NIndicator>
      </Example>

      <Example
        title="Indicator on input"
        description="Use a badge overlay to mark a field as required."
        code={`<NIndicator overlay="badge" content="Required" color="primary" position="top-end">
  <TextInput placeholder="Your email address" />
</NIndicator>`}
        center={false}
        previewHeight="h-40"
      >
        <div className="w-full max-w-sm">
          <NIndicator overlay="badge" content="Required" color="primary" position="top-end">
            <TextInput placeholder="Your email address" />
          </NIndicator>
        </div>
      </Example>

      <Example
        title="Button overlay"
        description="Use overlay='button' to place an interactive close button on a card."
        code={`<NIndicator
  overlay="button"
  content={<NButton variant="destructive" size="sm" className="size-7 rounded-full p-0">×</NButton>}
  position="top-end"
>
  <NCard title="Card Title">Rerum reiciendis beatae tenetur excepturi</NCard>
</NIndicator>`}
        center={false}
        previewHeight="h-48"
      >
        <div className="w-full max-w-sm">
          <NIndicator
            overlay="button"
            content={
              <NButton
                variant="destructive"
                size="sm"
                className="size-7 rounded-full p-0 text-sm"
                aria-label="Close"
              >
                <X size={14} />
              </NButton>
            }
            position="top-end"
          >
            <NCard title="Card Title">Rerum reiciendis beatae tenetur excepturi</NCard>
          </NIndicator>
        </div>
      </Example>

      <Example
        title="Ping animation"
        description="Use ping to add a radar ripple behind the dot or status overlay."
        code={`<NIndicator overlay="status" color="destructive" ping>
  <NButton variant="secondary">Notifications</NButton>
</NIndicator>`}
      >
        <NIndicator overlay="dot" color="destructive" ping>
          <NButton variant="secondary">
            <ShoppingBag size={16} />
          </NButton>
        </NIndicator>
        <NIndicator overlay="status" color="destructive" ping>
          <NButton variant="secondary">Notifications</NButton>
        </NIndicator>
        <NIndicator overlay="badge" content="+99" color="destructive" shape="pill" ping>
          <NButton variant="secondary">Inbox</NButton>
        </NIndicator>
      </Example>

      <Example
        title="Pulse animation"
        description="Use pulse to add a heartbeat-style animation to a badge."
        code={`<NIndicator overlay="badge" content="loading..." color="primary" pulse>
  <div className="size-32" />
</NIndicator>`}
      >
        <NIndicator overlay="badge" content="loading..." color="primary" pulse>
          <div className="size-32 rounded-md border border-base-content/20 bg-pink-500/10" />
        </NIndicator>
        <NIndicator overlay="badge" content="syncing" color="info" pulse>
          <div className="size-32 rounded-md border border-base-content/20 bg-sky-500/10" />
        </NIndicator>
      </Example>

      <Example
        title="Position grid"
        description="All 9 corner positions. Each overlay is centered on the corner."
        code={`<NIndicator position="top-start"><BellBox /></NIndicator>
<NIndicator position="top-center"><BellBox /></NIndicator>
<NIndicator position="top-end"><BellBox /></NIndicator>
<NIndicator position="middle-start"><BellBox /></NIndicator>
<NIndicator position="middle-center"><BellBox /></NIndicator>
<NIndicator position="middle-end"><BellBox /></NIndicator>
<NIndicator position="bottom-start"><BellBox /></NIndicator>
<NIndicator position="bottom-center"><BellBox /></NIndicator>
<NIndicator position="bottom-end"><BellBox /></NIndicator>`}
        center={false}
        previewHeight="h-80"
      >
        <div className="grid grid-cols-3 gap-8 p-4">
          {POSITIONS.map((pos) => (
            <div
              key={pos}
              className="flex flex-col items-center justify-center gap-2"
            >
              <NIndicator position={pos} color="primary" overlay="dot" size="md">
                <div className="size-16 rounded-md border-2 border-dashed border-slate-700 bg-slate-900/40" />
              </NIndicator>
              <span className="text-[10px] text-slate-500 font-mono">{pos}</span>
            </div>
          ))}
        </div>
      </Example>

      <Example
        title="Responsive position"
        description="Position changes per breakpoint. Resize the window to see it move."
        code={`<NIndicator
  position={{
    base: 'top-start',
    sm: 'middle-start',
    md: 'bottom-start',
    lg: 'top-center',
    xl: 'top-end',
  }}
  color="primary"
  overlay="dot"
>
  <div className="size-24 rounded-md border-2 border-dashed border-slate-700" />
</NIndicator>`}
        center={false}
        previewHeight="h-48"
      >
        <div className="w-full flex items-center justify-center">
          <NIndicator
            position={{
              base: 'top-start',
              sm: 'middle-start',
              md: 'bottom-start',
              lg: 'top-center',
              xl: 'top-end',
            }}
            color="primary"
            overlay="dot"
            size="md"
          >
            <div className="size-28 rounded-md border-2 border-dashed border-slate-700 bg-slate-900/40" />
          </NIndicator>
        </div>
      </Example>

      <Example
        title="RTL support"
        description="The horizontal translate flips automatically under dir='rtl'."
        code={`<div dir="rtl">
  <NIndicator position="top-start" color="primary" overlay="dot">
    <BellBox />
  </NIndicator>
</div>`}
        center={false}
        previewHeight="h-32"
      >
        <div className="w-full max-w-xs mx-auto" dir="rtl">
          <NIndicator position="top-start" color="primary" overlay="dot">
            <BellBox />
          </NIndicator>
          <NIndicator position="top-end" color="info" overlay="dot" className="ms-4">
            <BellBox />
          </NIndicator>
        </div>
      </Example>

      <Example
        title="Color variants"
        description="All 8 colors share the same dot geometry."
        code={`<NIndicator color="primary" overlay="dot"><BellBox /></NIndicator>
<NIndicator color="secondary" overlay="dot"><BellBox /></NIndicator>
<NIndicator color="accent" overlay="dot"><BellBox /></NIndicator>
<NIndicator color="neutral" overlay="dot"><BellBox /></NIndicator>
<NIndicator color="info" overlay="dot"><BellBox /></NIndicator>
<NIndicator color="success" overlay="dot"><BellBox /></NIndicator>
<NIndicator color="warning" overlay="dot"><BellBox /></NIndicator>
<NIndicator color="destructive" overlay="dot"><BellBox /></NIndicator>`}
      >
        {(
          [
            'primary',
            'secondary',
            'accent',
            'neutral',
            'info',
            'success',
            'warning',
            'destructive',
          ] as const
        ).map((c) => (
          <NIndicator key={c} color={c} overlay="dot">
            <BellBox />
          </NIndicator>
        ))}
      </Example>

      <Example
        title="Size variants"
        description="size scales the dot and status overlays (badges size themselves)."
        code={`<NIndicator size="sm"><BellBox /></NIndicator>
<NIndicator size="md"><BellBox /></NIndicator>
<NIndicator size="lg"><BellBox /></NIndicator>`}
      >
        <NIndicator size="sm">
          <BellBox />
        </NIndicator>
        <NIndicator size="md">
          <BellBox />
        </NIndicator>
        <NIndicator size="lg">
          <BellBox />
        </NIndicator>
        <NIndicator overlay="status" size="sm">
          <BellBox />
        </NIndicator>
        <NIndicator overlay="status" size="md">
          <BellBox />
        </NIndicator>
        <NIndicator overlay="status" size="lg">
          <BellBox />
        </NIndicator>
      </Example>

      <Example
        title="Indicator alias"
        description="Indicator is an alias of NIndicator."
        code={`<Indicator color="success" overlay="status" ping>
  <BellBox />
</Indicator>`}
      >
        <Indicator color="success" overlay="status" ping>
          <BellBox />
        </Indicator>
      </Example>
    </ComponentPage>
  );
}
