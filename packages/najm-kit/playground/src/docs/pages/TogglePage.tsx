import React, { useState } from 'react';
import { Switch, Label } from 'najm-kit';
import { ComponentPage } from '../ComponentPage';
import { Example } from '../Example';

const COLORS: Array<{ label: string; color: React.ComponentProps<typeof Switch>['color'] }> = [
  { label: 'Default',   color: 'default' },
  { label: 'Primary',   color: 'primary' },
  { label: 'Secondary', color: 'secondary' },
  { label: 'Accent',    color: 'accent' },
  { label: 'Info',      color: 'info' },
  { label: 'Success',   color: 'success' },
  { label: 'Warning',   color: 'warning' },
  { label: 'Error',     color: 'error' },
  { label: 'Neutral',   color: 'neutral' },
];

const SIZES: Array<{ label: string; size: React.ComponentProps<typeof Switch>['size'] }> = [
  { label: 'xs',    size: 'xs' },
  { label: 'sm',    size: 'sm' },
  { label: 'md',    size: 'default' },
  { label: 'lg',    size: 'lg' },
  { label: 'xl',    size: 'xl' },
];

function ControlledSwitch({ label }: { label: string }) {
  const [checked, setChecked] = useState(false);
  return (
    <div className="flex items-center gap-3">
      <Switch checked={checked} onCheckedChange={setChecked} color="primary" />
      <span className="text-sm text-slate-400">{checked ? 'On' : 'Off'} — {label}</span>
    </div>
  );
}

export function TogglePage() {
  return (
    <ComponentPage
      title="Toggle (Switch)"
      description="A pill-shaped on/off switch for boolean settings — ideal for enabling features, toggling preferences, or controlling visibility."
      category="Forms"
    >
      <Example
        title="Toggle"
        description="The default toggle in both unchecked and checked states."
        code={`import { Switch } from 'najm-kit';

<Switch />
<Switch defaultChecked />`}
        previewHeight="h-28"
      >
        <Switch />
        <Switch defaultChecked />
      </Example>

      <Example
        title="With fieldset and label"
        description="Use inside a form with a Label for accessibility."
        code={`import { Switch, Label } from 'najm-kit';

<div className="flex items-center gap-3 rounded-lg border border-slate-700/60 px-4 py-3">
  <Switch id="remember" defaultChecked color="primary" />
  <Label htmlFor="remember" className="cursor-pointer select-none">
    Remember me
  </Label>
</div>`}
        previewHeight="h-28"
        center={false}
      >
        <div className="flex w-full max-w-xs items-center justify-between rounded-lg border border-slate-700/60 bg-slate-800/30 px-4 py-3 mx-auto">
          <div>
            <Label htmlFor="remember" className="cursor-pointer select-none text-sm font-medium text-slate-200">
              Remember me
            </Label>
            <p className="text-xs text-slate-500 mt-0.5">Stay signed in for 30 days</p>
          </div>
          <Switch id="remember" defaultChecked color="primary" />
        </div>
      </Example>

      <Example
        title="Sizes"
        description="Five sizes from extra-small to extra-large — all shown checked."
        code={`<Switch size="xs" defaultChecked />
<Switch size="sm" defaultChecked />
<Switch size="default" defaultChecked />
<Switch size="lg" defaultChecked />
<Switch size="xl" defaultChecked />`}
        previewHeight="h-28"
      >
        {SIZES.map(({ label, size }) => (
          <div key={label} className="flex flex-col items-center gap-1.5">
            <Switch size={size} defaultChecked color="primary" />
            <span className="text-[10px] text-slate-500">{label}</span>
          </div>
        ))}
      </Example>

      <Example
        title="Colors"
        description="Semantic color variants — all shown in the checked state."
        code={`<Switch color="primary"   defaultChecked />
<Switch color="secondary" defaultChecked />
<Switch color="accent"    defaultChecked />
<Switch color="info"      defaultChecked />
<Switch color="success"   defaultChecked />
<Switch color="warning"   defaultChecked />
<Switch color="error"     defaultChecked />
<Switch color="neutral"   defaultChecked />`}
        previewHeight="h-32"
      >
        {COLORS.map(({ label, color }) => (
          <div key={label} className="flex flex-col items-center gap-1.5">
            <Switch color={color} defaultChecked />
            <span className="text-[10px] text-slate-500">{label}</span>
          </div>
        ))}
      </Example>

      <Example
        title="Disabled"
        description="Disabled state in both unchecked and checked positions."
        code={`<Switch disabled />
<Switch disabled defaultChecked />`}
        previewHeight="h-28"
      >
        <Switch disabled />
        <Switch disabled defaultChecked />
      </Example>

      <Example
        title="Controlled toggle"
        description="Use checked + onCheckedChange to control state from your component."
        code={`const [enabled, setEnabled] = useState(false);

<Switch
  checked={enabled}
  onCheckedChange={setEnabled}
  color="primary"
/>
<span>{enabled ? 'Enabled' : 'Disabled'}</span>`}
        previewHeight="h-36"
        center={false}
      >
        <div className="flex flex-col gap-3 px-8 w-full">
          <ControlledSwitch label="Notifications" />
          <ControlledSwitch label="Dark mode" />
          <ControlledSwitch label="Auto-save" />
        </div>
      </Example>

      <Example
        title="In a settings panel"
        description="Real-world usage inside a settings list with labels and descriptions."
        code={`const settings = [
  { id: 'notifs', label: 'Push notifications', desc: 'Receive alerts on your device', color: 'primary' },
  { id: 'emails', label: 'Marketing emails',   desc: 'News, tips and product updates', color: 'secondary' },
  { id: 'sound',  label: 'Sound effects',      desc: 'Play sounds for key actions',    color: 'success' },
];

{settings.map(s => (
  <div key={s.id} className="flex items-center justify-between py-3 border-b border-slate-800">
    <div>
      <Label htmlFor={s.id}>{s.label}</Label>
      <p className="text-xs text-slate-500">{s.desc}</p>
    </div>
    <Switch id={s.id} defaultChecked color={s.color} />
  </div>
))}`}
        previewHeight="h-52"
        center={false}
      >
        <div className="w-full max-w-sm mx-auto divide-y divide-slate-800/80 px-4">
          {[
            { id: 'notifs', label: 'Push notifications', desc: 'Receive alerts on your device',     color: 'primary'   as const, checked: true  },
            { id: 'emails', label: 'Marketing emails',   desc: 'News, tips and product updates',    color: 'secondary' as const, checked: false },
            { id: 'sound',  label: 'Sound effects',      desc: 'Play sounds for key actions',        color: 'success'   as const, checked: true  },
            { id: 'sync',   label: 'Auto sync',           desc: 'Keep data in sync across devices',  color: 'info'      as const, checked: true  },
          ].map((s) => (
            <div key={s.id} className="flex items-center justify-between py-3">
              <div>
                <Label htmlFor={s.id} className="text-sm font-medium text-slate-200 cursor-pointer">
                  {s.label}
                </Label>
                <p className="text-xs text-slate-500 mt-0.5">{s.desc}</p>
              </div>
              <Switch id={s.id} defaultChecked={s.checked} color={s.color} />
            </div>
          ))}
        </div>
      </Example>

      <Example
        title="Custom colors"
        description="Override the checked color using className with any Tailwind color."
        code={`<Switch className="data-[state=checked]:bg-indigo-500" defaultChecked />
<Switch className="data-[state=checked]:bg-rose-500"   defaultChecked />
<Switch className="data-[state=checked]:bg-teal-500"   defaultChecked />
<Switch className="data-[state=checked]:bg-fuchsia-500" defaultChecked />`}
        previewHeight="h-28"
      >
        <Switch className="data-[state=checked]:bg-indigo-500"  defaultChecked />
        <Switch className="data-[state=checked]:bg-rose-500"    defaultChecked />
        <Switch className="data-[state=checked]:bg-teal-500"    defaultChecked />
        <Switch className="data-[state=checked]:bg-fuchsia-500" defaultChecked />
        <Switch className="data-[state=checked]:bg-lime-400"    defaultChecked />
      </Example>
    </ComponentPage>
  );
}
