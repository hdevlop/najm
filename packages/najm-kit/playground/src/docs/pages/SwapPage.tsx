import React, { useState } from 'react';
import { Swap } from 'najm-kit';
import { ComponentPage } from '../ComponentPage';
import { Example } from '../Example';

export function SwapPage() {
  const [themeDark, setThemeDark] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [volumeOn, setVolumeOn] = useState(true);
  const [basicChecked, setBasicChecked] = useState(false);
  const [notifOn, setNotifOn] = useState(false);

  return (
    <ComponentPage
      title="Swap"
      description="A two-state display primitive for toggling between content, like theme switches, hamburger icons, or volume toggles."
      category="Actions"
    >
      <Example
        title="Text props"
        description="Use onText and offText for plain label toggles — no children needed."
        code={`import { Swap } from 'najm-kit';

<Swap onText="Enabled" offText="Disabled" />
<Swap onText="Active" offText="Inactive" size="sm" />
<Swap onText="ON" offText="OFF" size="lg" />`}
      >
        <div className="flex items-center gap-3">
          <Swap onText="Enabled" offText="Disabled" />
          <Swap onText="Active" offText="Inactive" size="sm" />
          <Swap onText="ON" offText="OFF" size="lg" />
        </div>
      </Example>

      <Example
        title="Icon props — string names"
        description="Pass a Lucide icon name as a string to onIcon / offIcon. No imports needed."
        code={`<Swap onIcon="sun" offIcon="moon" size="icon" effect="rotate" />
<Swap onIcon="volume-2" offIcon="volume-x" size="icon" />
<Swap onIcon="menu" offIcon="x" size="icon" effect="flip" />`}
      >
        <div className="flex items-center gap-3">
          <Swap onIcon="sun" offIcon="moon" size="icon" effect="rotate" />
          <Swap onIcon="volume-2" offIcon="volume-x" size="icon" />
          <Swap onIcon="menu" offIcon="x" size="icon" effect="flip" />
        </div>
      </Example>

      <Example
        title="Icon + text together"
        description="Combine onIcon + onText (and offIcon + offText) for labeled icon buttons."
        code={`<Swap
  onIcon="bell" onText="On"
  offIcon="bell-off" offText="Off"
/>
<Swap
  onIcon="eye" onText="Visible"
  offIcon="eye-off" offText="Hidden"
  size="sm"
/>`}
      >
        <div className="flex items-center gap-3">
          <Swap
            checked={notifOn}
            onCheckedChange={setNotifOn}
            onIcon="bell"
            onText="On"
            offIcon="bell-off"
            offText="Off"
          />
          <Swap
            onIcon="eye"
            onText="Visible"
            offIcon="eye-off"
            offText="Hidden"
            size="sm"
          />
        </div>
      </Example>

      <Example
        title="Controlled swap"
        description="Use checked and onCheckedChange for controlled state."
        code={`const [on, setOn] = useState(false);

<Swap
  checked={on}
  onCheckedChange={setOn}
  onText="Enabled"
  offText="Disabled"
/>`}
      >
        <Swap
          checked={basicChecked}
          onCheckedChange={setBasicChecked}
          onText="Enabled"
          offText="Disabled"
        />
      </Example>

      <Example
        title="Theme toggle"
        description="Rotate effect for a sun/moon icon swap using string names."
        code={`const [dark, setDark] = useState(false);

<Swap
  checked={dark}
  onCheckedChange={setDark}
  onIcon="sun"
  offIcon="moon"
  effect="rotate"
  size="icon"
/>`}
      >
        <Swap
          checked={themeDark}
          onCheckedChange={setThemeDark}
          onIcon="sun"
          offIcon="moon"
          effect="rotate"
          size="icon"
        />
      </Example>

      <Example
        title="Hamburger menu"
        description="Flip effect for hamburger/close icon swap."
        code={`const [open, setOpen] = useState(false);

<Swap
  checked={open}
  onCheckedChange={setOpen}
  onIcon="x"
  offIcon="menu"
  effect="flip"
  size="icon"
/>`}
      >
        <Swap
          checked={menuOpen}
          onCheckedChange={setMenuOpen}
          onIcon="x"
          offIcon="menu"
          effect="flip"
          size="icon"
        />
      </Example>

      <Example
        title="Volume toggle"
        description="Icon swap without an effect."
        code={`const [on, setOn] = useState(true);

<Swap
  checked={on}
  onCheckedChange={setOn}
  onIcon="volume-2"
  offIcon="volume-x"
  size="icon"
/>`}
      >
        <Swap
          checked={volumeOn}
          onCheckedChange={setVolumeOn}
          onIcon="volume-2"
          offIcon="volume-x"
          size="icon"
        />
      </Example>

      <Example
        title="Custom content"
        description="Pass on / off as ReactNode for full custom content — overrides icon/text props."
        code={`<Swap
  on={<span className="text-green-500 font-bold">✓ YES</span>}
  off={<span className="text-red-500 font-bold">✕ NO</span>}
/>`}
      >
        <Swap
          on={<span className="text-green-500 font-bold">✓ YES</span>}
          off={<span className="text-red-500 font-bold">✕ NO</span>}
        />
      </Example>

      <Example
        title="Indeterminate state"
        description="A third visual state for mixed/undefined values."
        code={`<Swap
  state="indeterminate"
  onText="Enabled"
  offText="Disabled"
  indeterminateText="Mixed"
/>
<Swap
  state="indeterminate"
  onIcon="check"
  offIcon="x"
  indeterminateIcon="minus"
  size="icon"
/>`}
      >
        <div className="flex items-center gap-3">
          <Swap
            state="indeterminate"
            onText="Enabled"
            offText="Disabled"
            indeterminateText="Mixed"
          />
          <Swap
            state="indeterminate"
            onIcon="check"
            offIcon="x"
            indeterminateIcon="minus"
            size="icon"
          />
        </div>
      </Example>

      <Example
        title="Sizes"
        description="Available sizes: sm, md, lg, icon."
        code={`<Swap onText="ON" offText="OFF" size="sm" />
<Swap onText="ON" offText="OFF" size="md" />
<Swap onText="ON" offText="OFF" size="lg" />
<Swap onIcon="sun" offIcon="moon" size="icon" />`}
      >
        <div className="flex items-center gap-3">
          <Swap onText="ON" offText="OFF" size="sm" />
          <Swap onText="ON" offText="OFF" size="md" />
          <Swap onText="ON" offText="OFF" size="lg" />
          <Swap onIcon="sun" offIcon="moon" size="icon" />
        </div>
      </Example>

      <Example
        title="Disabled"
        description="A disabled swap cannot be toggled."
        code={`<Swap onText="ON" offText="OFF" disabled />
<Swap onIcon="sun" offIcon="moon" size="icon" disabled />`}
      >
        <div className="flex items-center gap-3">
          <Swap onText="ON" offText="OFF" disabled />
          <Swap onIcon="sun" offIcon="moon" size="icon" disabled />
        </div>
      </Example>
    </ComponentPage>
  );
}
