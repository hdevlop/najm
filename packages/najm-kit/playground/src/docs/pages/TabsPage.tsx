import React, { useState } from 'react';
import { NTabs, NEditorTabs, getNextEditorTabValue, Tabs, TabsList, TabsTrigger, TabsContent, ColorPickerInput, NButton } from 'najm-kit';
import type { NEditorTab } from 'najm-kit';
import { ComponentPage } from '../ComponentPage';
import { Example } from '../Example';

const editorContent = (text: string) => (
  <div className="h-24 bg-card p-4 text-sm text-muted-foreground">{text}</div>
);

const initialEditorTabs: NEditorTab[] = [
  { value: 'home', name: 'Home', icon: 'Home', closable: false, content: editorContent('Home — not closable.') },
  { value: 'classy.ase', name: 'classy.ase', dirty: true, content: editorContent('classy.ase — dirty: hover the dot to reveal the close button.') },
  { value: 'palette.ase', name: 'palette.ase', content: editorContent('palette.ase — clean, closable.') },
  { value: 'long.ase', name: 'a-really-long-file-name-that-truncates.ase', content: editorContent('Long name — hover the tab label for the truncation tooltip.') },
];

export function TabsPage() {
  const [accentColor, setAccentColor] = useState('#6366f1');
  const [showBordered, setShowBordered] = useState(false);

  const [editorTabs, setEditorTabs] = useState(initialEditorTabs);
  const [activeEditorTab, setActiveEditorTab] = useState('classy.ase');

  const closeEditorTab = (value: string) => {
    if (value === activeEditorTab) {
      setActiveEditorTab(getNextEditorTabValue(editorTabs, value) ?? '');
    }
    setEditorTabs(editorTabs.filter((tab) => tab.value !== value));
  };

  const tabItems = [
    { value: 'account',  icon: 'User',     label: 'Account',  content: <p className="text-sm text-muted-foreground pt-2">Account settings content.</p> },
    { value: 'password', icon: 'KeyRound', label: 'Password', content: <p className="text-sm text-muted-foreground pt-2">Change your password here.</p> },
    { value: 'settings', icon: 'Settings', label: 'Settings', content: <p className="text-sm text-muted-foreground pt-2">Other settings content.</p> },
  ];

  return (
    <ComponentPage
      title="Tabs"
      description="A set of layered sections of content that display one panel at a time. Supports pills, underline, bordered, and ghost variants."
      category="Data Display"
    >
      <Example
        title="Pills (default)"
        description="Pick an accent color to preview custom tab styling. Toggle bordered to see border+text-only coloring."
        code={`<NTabs
  accentColor="#6366f1"
  defaultValue="account"
  fullWidth
  items={[...]}
/>`}
        center={false}
      >
        <div className="w-full flex flex-col gap-5">
          <div className="flex items-end gap-4 flex-wrap">
            <div className="max-w-xs">
              <span className="text-xs text-muted-foreground font-medium block mb-1">Accent color</span>
              <ColorPickerInput value={accentColor} onChange={setAccentColor} />
            </div>
            <label className="flex items-center gap-2 cursor-pointer pb-1">
              <input
                type="checkbox"
                checked={showBordered}
                onChange={e => setShowBordered(e.target.checked)}
                className="accent-current w-4 h-4 cursor-pointer"
                style={{ accentColor }}
              />
              <span className="text-sm text-muted-foreground">Bordered</span>
            </label>
          </div>
          <NTabs
            variant={showBordered ? 'bordered' : 'pills'}
            accentColor={accentColor}
            defaultValue="account"
            fullWidth
            items={tabItems}
          />
        </div>
      </Example>

      <Example
        title="Underline"
        description="Active tab is indicated by a bottom border underline — clean and minimal."
        code={`<NTabs
  variant="underline"
  defaultValue="profile"
  items={[
    { value: 'profile',   label: 'Profile',   content: 'Profile content.' },
    { value: 'dashboard', label: 'Dashboard', content: 'Dashboard content.' },
    { value: 'settings',  label: 'Settings',  content: 'Settings content.' },
    { value: 'contacts',  label: 'Contacts',  content: 'Contacts content.', disabled: true },
  ]}
/>`}
        center={false}
      >
        <div className="w-full max-w-md">
          <NTabs
            variant="underline"
            defaultValue="profile"
            items={[
              { value: 'profile',   label: 'Profile',   content: <p className="text-sm text-muted-foreground pt-3">Profile content goes here. Edit your personal information.</p> },
              { value: 'dashboard', label: 'Dashboard', content: <p className="text-sm text-muted-foreground pt-3">Dashboard content goes here. View your analytics.</p> },
              { value: 'settings',  label: 'Settings',  content: <p className="text-sm text-muted-foreground pt-3">Settings content goes here. Manage your preferences.</p> },
              { value: 'contacts',  label: 'Contacts',  content: null, disabled: true },
            ]}
          />
        </div>
      </Example>

      <Example
        title="Underline with icons"
        description="Pass any Lucide icon name as a string — NTabs resolves it automatically."
        code={`<NTabs
  variant="underline"
  defaultValue="profile"
  items={[
    { value: 'profile',   icon: 'User',          label: 'Profile',   content: 'Profile content.' },
    { value: 'dashboard', icon: 'LayoutDashboard', label: 'Dashboard', content: 'Dashboard content.' },
    { value: 'settings',  icon: 'Settings',      label: 'Settings',  content: 'Settings content.' },
  ]}
/>`}
        center={false}
      >
        <div className="w-full max-w-md">
          <NTabs
            variant="underline"
            defaultValue="profile"
            items={[
              { value: 'profile',   icon: 'User',            label: 'Profile',   content: <p className="text-sm text-muted-foreground pt-3">Profile content goes here.</p> },
              { value: 'dashboard', icon: 'LayoutDashboard', label: 'Dashboard', content: <p className="text-sm text-muted-foreground pt-3">Dashboard content goes here.</p> },
              { value: 'settings',  icon: 'Settings',        label: 'Settings',  content: <p className="text-sm text-muted-foreground pt-3">Settings content goes here.</p> },
            ]}
          />
        </div>
      </Example>

      <Example
        title="Bordered"
        description="Active tab shows a top border card-like appearance, as if opening a folder."
        code={`<NTabs
  variant="bordered"
  defaultValue="overview"
  items={[
    { value: 'overview', label: 'Overview', content: 'Overview content.' },
    { value: 'features', label: 'Features', content: 'Features content.' },
    { value: 'pricing',  label: 'Pricing',  content: 'Pricing content.'  },
  ]}
/>`}
        center={false}
      >
        <div className="w-full max-w-md">
          <NTabs
            variant="bordered"
            defaultValue="overview"
            items={[
              { value: 'overview', label: 'Overview', content: <p className="text-sm text-muted-foreground pt-3 border-t border-border mt-0">Overview content goes here.</p> },
              { value: 'features', label: 'Features', content: <p className="text-sm text-muted-foreground pt-3 border-t border-border mt-0">Features content goes here.</p> },
              { value: 'pricing',  label: 'Pricing',  content: <p className="text-sm text-muted-foreground pt-3 border-t border-border mt-0">Pricing content goes here.</p> },
            ]}
          />
        </div>
      </Example>

      <Example
        title="Editor tabs"
        description="IDE/browser-style tab bar: closable tabs, dirty-state dot, optional icon, and a tooltip when the name truncates. getNextEditorTabValue picks the tab to activate after a close."
        code={`const [tabs, setTabs] = useState<NEditorTab[]>([
  { value: 'home', name: 'Home', icon: 'Home', closable: false, content: ... },
  { value: 'classy.ase', name: 'classy.ase', dirty: true, content: ... },
  { value: 'palette.ase', name: 'palette.ase', content: ... },
]);
const [active, setActive] = useState('classy.ase');

<NEditorTabs
  items={tabs}
  value={active}
  onValueChange={setActive}
  onClose={(value) => {
    if (value === active) setActive(getNextEditorTabValue(tabs, value) ?? '');
    setTabs(tabs.filter((tab) => tab.value !== value));
  }}
/>`}
        center={false}
      >
        <div className="w-full">
          {editorTabs.length > 0 ? (
            <NEditorTabs
              items={editorTabs}
              value={activeEditorTab}
              onValueChange={setActiveEditorTab}
              onClose={closeEditorTab}
            />
          ) : (
            <div className="flex items-center gap-3 border-b border-border pb-3">
              <p className="text-sm text-muted-foreground">All tabs closed.</p>
              <NButton
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditorTabs(initialEditorTabs);
                  setActiveEditorTab('classy.ase');
                }}
              >
                Reset demo
              </NButton>
            </div>
          )}
        </div>
      </Example>

      <Example
        title="Ghost"
        description="Minimal tabs with no borders — active tab gets a subtle background."
        code={`<NTabs
  variant="ghost"
  defaultValue="all"
  items={[
    { value: 'all',       label: 'All'       },
    { value: 'active',    label: 'Active'    },
    { value: 'completed', label: 'Completed' },
    { value: 'archived',  label: 'Archived'  },
  ]}
/>`}
        center={false}
      >
        <div className="w-full max-w-md">
          <NTabs
            variant="ghost"
            defaultValue="all"
            items={[
              { value: 'all',       label: 'All',       content: <p className="text-sm text-muted-foreground pt-2">All items content.</p> },
              { value: 'active',    label: 'Active',    content: <p className="text-sm text-muted-foreground pt-2">Active items content.</p> },
              { value: 'completed', label: 'Completed', content: <p className="text-sm text-muted-foreground pt-2">Completed items content.</p> },
              { value: 'archived',  label: 'Archived',  content: <p className="text-sm text-muted-foreground pt-2">Archived items content.</p> },
            ]}
          />
        </div>
      </Example>

      <Example
        title="Full width"
        description="Tabs stretch to fill the entire width equally."
        code={`<NTabs
  variant="underline"
  defaultValue="profile"
  fullWidth
  items={[
    { value: 'profile',   label: 'Profile'   },
    { value: 'dashboard', label: 'Dashboard' },
    { value: 'settings',  label: 'Settings'  },
    { value: 'invoice',   label: 'Invoice'   },
  ]}
/>`}
        center={false}
      >
        <div className="w-full max-w-md">
          <NTabs
            variant="underline"
            defaultValue="profile"
            fullWidth
            items={[
              { value: 'profile',   label: 'Profile',   content: <p className="text-sm text-muted-foreground pt-3">Profile content.</p> },
              { value: 'dashboard', label: 'Dashboard', content: <p className="text-sm text-muted-foreground pt-3">Dashboard content.</p> },
              { value: 'settings',  label: 'Settings',  content: <p className="text-sm text-muted-foreground pt-3">Settings content.</p> },
              { value: 'invoice',   label: 'Invoice',   content: <p className="text-sm text-muted-foreground pt-3">Invoice content.</p> },
            ]}
          />
        </div>
      </Example>

      <Example
        title="Vertical tabs"
        description="Side-by-side layout with tabs stacked vertically on the left."
        code={`<NTabs
  variant="pills"
  orientation="vertical"
  defaultValue="profile"
  items={[
    { value: 'profile',       icon: 'User',            label: 'Profile',       content: 'Profile content.' },
    { value: 'dashboard',     icon: 'LayoutDashboard', label: 'Dashboard',     content: 'Dashboard content.' },
    { value: 'settings',      icon: 'Settings',        label: 'Settings',      content: 'Settings content.' },
    { value: 'notifications', icon: 'Bell',            label: 'Notifications', content: 'Notifications content.' },
  ]}
/>`}
        center={false}
      >
        <div className="w-full max-w-lg">
          <NTabs
            variant="pills"
            orientation="vertical"
            defaultValue="profile"
            classNames={{ list: 'w-40' }}
            items={[
              { value: 'profile',       icon: 'User',            label: 'Profile',       content: <div className="rounded-lg border border-border bg-card p-4"><h4 className="text-sm font-medium text-foreground mb-1">Profile</h4><p className="text-sm text-muted-foreground">Manage your personal information and preferences.</p></div> },
              { value: 'dashboard',     icon: 'LayoutDashboard', label: 'Dashboard',     content: <div className="rounded-lg border border-border bg-card p-4"><h4 className="text-sm font-medium text-foreground mb-1">Dashboard</h4><p className="text-sm text-muted-foreground">View your analytics and recent activity.</p></div> },
              { value: 'settings',      icon: 'Settings',        label: 'Settings',      content: <div className="rounded-lg border border-border bg-card p-4"><h4 className="text-sm font-medium text-foreground mb-1">Settings</h4><p className="text-sm text-muted-foreground">Configure your application settings.</p></div> },
              { value: 'notifications', icon: 'Bell',            label: 'Notifications', content: <div className="rounded-lg border border-border bg-card p-4"><h4 className="text-sm font-medium text-foreground mb-1">Notifications</h4><p className="text-sm text-muted-foreground">Manage your notification preferences.</p></div> },
            ]}
          />
        </div>
      </Example>

      <Example
        title="Color presets"
        description="Use the color prop to apply a structured background preset to the list and active trigger. Works with any variant."
        code={`<NTabs color="primary" defaultValue="overview" items={[...]} />
<NTabs color="card"    defaultValue="overview" items={[...]} />
<NTabs color="ghost"   defaultValue="overview" items={[...]} />

{/* color also works on other variants */}
<NTabs color="primary" variant="underline" defaultValue="overview" items={[...]} />`}
        center={false}
      >
        <div className="w-full max-w-md flex flex-col gap-4">
          <NTabs
            color="primary"
            defaultValue="overview"
            items={[
              { value: 'overview', label: 'Overview', content: <p className="text-sm text-muted-foreground pt-2">Overview — <code>color="primary"</code></p> },
              { value: 'details',  label: 'Details',  content: <p className="text-sm text-muted-foreground pt-2">Details content.</p> },
              { value: 'history',  label: 'History',  content: <p className="text-sm text-muted-foreground pt-2">History content.</p> },
            ]}
          />
          <NTabs
            color="card"
            defaultValue="overview"
            items={[
              { value: 'overview', label: 'Overview', content: <p className="text-sm text-muted-foreground pt-2">Overview — <code>color="card"</code></p> },
              { value: 'details',  label: 'Details',  content: <p className="text-sm text-muted-foreground pt-2">Details content.</p> },
              { value: 'history',  label: 'History',  content: <p className="text-sm text-muted-foreground pt-2">History content.</p> },
            ]}
          />
          <NTabs
            color="ghost"
            defaultValue="overview"
            items={[
              { value: 'overview', label: 'Overview', content: <p className="text-sm text-muted-foreground pt-2">Overview — <code>color="ghost"</code></p> },
              { value: 'details',  label: 'Details',  content: <p className="text-sm text-muted-foreground pt-2">Details content.</p> },
              { value: 'history',  label: 'History',  content: <p className="text-sm text-muted-foreground pt-2">History content.</p> },
            ]}
          />
          <NTabs
            color="primary"
            variant="underline"
            defaultValue="overview"
            items={[
              { value: 'overview', label: 'Overview', content: <p className="text-sm text-muted-foreground pt-2">Overview — <code>color="primary"</code> + <code>variant="underline"</code></p> },
              { value: 'details',  label: 'Details',  content: <p className="text-sm text-muted-foreground pt-2">Details content.</p> },
              { value: 'history',  label: 'History',  content: <p className="text-sm text-muted-foreground pt-2">History content.</p> },
            ]}
          />
        </div>
      </Example>

      <Example
        title="With disabled tab"
        code={`<NTabs
  defaultValue="active"
  items={[
    { value: 'active',   label: 'Active'   },
    { value: 'disabled', label: 'Disabled', disabled: true },
    { value: 'other',    label: 'Other'    },
  ]}
/>`}
      >
        <div className="w-full max-w-sm">
          <NTabs
            defaultValue="active"
            items={[
              { value: 'active',   label: 'Active',   content: <p className="text-sm text-muted-foreground pt-2">Active tab content.</p> },
              { value: 'disabled', label: 'Disabled', content: null, disabled: true },
              { value: 'other',    label: 'Other',    content: <p className="text-sm text-muted-foreground pt-2">Other tab content.</p> },
            ]}
          />
        </div>
      </Example>

      <Example
        title="Primitive API (lower-level)"
        description="Use the individual Tabs primitives when you need full control over the markup."
        code={`import { Tabs, TabsList, TabsTrigger, TabsContent } from 'najm-kit';

<Tabs defaultValue="account">
  <TabsList variant="pills">
    <TabsTrigger value="account" variant="pills">Account</TabsTrigger>
    <TabsTrigger value="password" variant="pills">Password</TabsTrigger>
  </TabsList>
  <TabsContent value="account">Account settings content.</TabsContent>
  <TabsContent value="password">Change your password here.</TabsContent>
</Tabs>`}
        center={false}
      >
        <div className="w-full max-w-sm">
          <Tabs defaultValue="account">
            <TabsList variant="pills">
              <TabsTrigger value="account" variant="pills">Account</TabsTrigger>
              <TabsTrigger value="password" variant="pills">Password</TabsTrigger>
            </TabsList>
            <TabsContent value="account"><p className="text-sm text-muted-foreground pt-2">Account settings content.</p></TabsContent>
            <TabsContent value="password"><p className="text-sm text-muted-foreground pt-2">Change your password here.</p></TabsContent>
          </Tabs>
        </div>
      </Example>
    </ComponentPage>
  );
}
