import React from 'react';
import {
  Badge,
  Input,
  NButton,
  NCard,
  NPageHeader,
  NPageHeaderActions,
  NSheet,
  NSidebar,
} from 'najm-kit';
import type { NajmBorderDegree, NavItem } from 'najm-kit';
import {
  BarChart3,
  Bell,
  BookOpen,
  CalendarDays,
  ChevronRight,
  CreditCard,
  GraduationCap,
  Inbox,
  LayoutDashboard,
  Plus,
  Shield,
  Users,
} from 'lucide-react';
import { ComponentPage } from '../ComponentPage';
import { Example } from '../Example';

const sidebarItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, sectionLabel: 'Workspace' },
  { id: 'students', label: 'Students', icon: Users, sectionLabel: 'Workspace' },
  { id: 'classes', label: 'Classes', icon: BookOpen, sectionLabel: 'Workspace' },
  { id: 'calendar', label: 'Calendar', icon: CalendarDays, sectionLabel: 'Workspace' },
  {
    id: 'messages',
    label: 'Messages',
    icon: Inbox,
    badge: <span className="rounded-full bg-primary px-1.5 py-0.5 text-[10px] font-semibold text-primary-foreground">8</span>,
    sectionLabel: 'Communication',
  },
  { id: 'announcements', label: 'Announcements', icon: Bell, sectionLabel: 'Communication' },
  { id: 'reports', label: 'Reports', icon: BarChart3, sectionLabel: 'Admin' },
  { id: 'billing', label: 'Billing', icon: CreditCard, sectionLabel: 'Admin' },
  { id: 'security', label: 'Security', icon: Shield, sectionLabel: 'Admin' },
];

const borderDegrees: NajmBorderDegree[] = ['none', 'subtle', 'default', 'strong'];

function demoBorderClassForDegree(degree: NajmBorderDegree) {
  if (degree === 'none') return 'border border-transparent';
  if (degree === 'subtle') return 'border border-border-subtle';
  if (degree === 'strong') return 'border border-border-strong';
  return 'border border-border';
}

function clampWidth(value: number, min: number, max: number) {
  if (!Number.isFinite(value)) return min;
  return Math.min(max, Math.max(min, value));
}

function WidthInput({
  label,
  description,
  value,
  min,
  max,
  borderDegree,
  onChange,
}: {
  label: string;
  description: string;
  value: number;
  min: number;
  max: number;
  borderDegree: NajmBorderDegree;
  onChange: (value: number) => void;
}) {
  return (
    <NCard noPadding borderDegree={borderDegree} className="p-4">
      <label className="flex min-w-0 flex-col gap-2 text-sm">
        <span className="space-y-0.5">
          <span className="block font-medium text-foreground">{label}</span>
          <span className="block text-xs text-muted-foreground">{description}</span>
        </span>
        <div className="flex items-center gap-2">
          <Input
            type="number"
            inputMode="numeric"
            min={min}
            max={max}
            step={4}
            value={value}
            onChange={(event) => onChange(clampWidth(Number(event.currentTarget.value), min, max))}
            className="h-9"
          />
          <span className="rounded-md border border-border bg-muted px-2 py-1 text-xs text-muted-foreground">px</span>
        </div>
      </label>
    </NCard>
  );
}

function SidebarSettingsSheet({
  open,
  onOpenChange,
  expandedWidth,
  collapsedWidth,
  mobileWidth,
  borderDegree,
  onExpandedWidthChange,
  onCollapsedWidthChange,
  onMobileWidthChange,
  onBorderDegreeChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  expandedWidth: number;
  collapsedWidth: number;
  mobileWidth: number;
  borderDegree: NajmBorderDegree;
  onExpandedWidthChange: (value: number) => void;
  onCollapsedWidthChange: (value: number) => void;
  onMobileWidthChange: (value: number) => void;
  onBorderDegreeChange: (value: NajmBorderDegree) => void;
}) {
  return (
    <NSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Settings"
      description="Opened from the sidebar footer action."
      width={420}
      contentClassName={`bg-background ${demoBorderClassForDegree(borderDegree)}`}
      bodyClassName="space-y-4"
    >
      <NCard noPadding borderDegree={borderDegree} className="bg-muted/30 p-3 shadow-none">
        <p className="text-sm font-semibold text-foreground">Controls</p>
        <p className="mt-1 text-xs text-muted-foreground">Use inputs for precise sizing and choose the sidebar border strength.</p>
      </NCard>

      <NCard noPadding borderDegree={borderDegree} className="p-4">
        <div className="flex items-center justify-between gap-3">
          <span>
            <span className="block text-sm font-medium text-foreground">Border degree</span>
            <span className="mt-0.5 block text-xs text-muted-foreground">Controls the sidebar shell border.</span>
          </span>
          <span className="rounded-full border border-border bg-muted px-3 py-1 text-xs font-semibold capitalize text-foreground">
            {borderDegree}
          </span>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {borderDegrees.map((degree) => (
            <button
              key={degree}
              type="button"
              onClick={() => onBorderDegreeChange(degree)}
              className={`rounded-lg border px-3 py-2 text-xs font-semibold capitalize transition-colors ${
                borderDegree === degree
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border bg-background text-muted-foreground hover:bg-accent/40 hover:text-foreground'
              }`}
            >
              {degree}
            </button>
          ))}
        </div>
      </NCard>

      <WidthInput
        label="Expanded width"
        description="Default desktop sidebar width."
        value={expandedWidth}
        min={200}
        max={340}
        borderDegree={borderDegree}
        onChange={onExpandedWidthChange}
      />
      <WidthInput
        label="Collapsed width"
        description="Compact rail width after collapse."
        value={collapsedWidth}
        min={52}
        max={96}
        borderDegree={borderDegree}
        onChange={onCollapsedWidthChange}
      />
      <WidthInput
        label="Mobile drawer width"
        description="Drawer width for mobile preview mode."
        value={mobileWidth}
        min={220}
        max={360}
        borderDegree={borderDegree}
        onChange={onMobileWidthChange}
      />
    </NSheet>
  );
}

function PagePanel({ active, borderDegree }: { active: string; borderDegree: NajmBorderDegree }) {
  const title = active.replace(/-/g, ' ');

  return (
    <main className="flex min-w-0 flex-1 flex-col gap-3 overflow-hidden bg-background p-3">
      <NPageHeader
        bordered
        borderDegree={borderDegree}
        icon={LayoutDashboard}
        title={title}
        subtitle="Sidebar controls the active workspace view."
        headerClassName="pl-5"
      >
        <NPageHeaderActions>
          <NButton size="sm" bordered borderDegree={borderDegree}>
            <Plus size={14} />
            New
          </NButton>
        </NPageHeaderActions>
      </NPageHeader>

      <section className="min-h-0 flex-1 overflow-auto">
        <div className="grid gap-3 sm:grid-cols-3">
          {[
            ['Open tasks', '24', '+6'],
            ['Attendance', '94%', '+2%'],
            ['Invoices', '$18k', '-4%'],
          ].map(([label, value, delta]) => (
            <NCard key={label} borderDegree={borderDegree}>
              <p className="text-xs text-muted-foreground">{label}</p>
              <div className="mt-2 flex items-end justify-between gap-3">
                <p className="text-2xl font-semibold text-foreground">{value}</p>
                <Badge color={delta.startsWith('+') ? 'success' : 'warning'} look="soft">{delta}</Badge>
              </div>
            </NCard>
          ))}
        </div>

        <div className="mt-4 grid gap-3">
          {['Weekly planning', 'Parent follow-up', 'Class capacity review'].map((item) => (
            <NCard
              key={item}
              noPadding
              borderDegree={borderDegree}
              className="flex-row items-center justify-between px-4 py-3"
            >
              <div>
                <p className="text-sm font-medium text-foreground">{item}</p>
                <p className="text-xs text-muted-foreground">Assigned to operations</p>
              </div>
              <ChevronRight size={16} className="text-muted-foreground" />
            </NCard>
          ))}
        </div>
      </section>
    </main>
  );
}

function FullSidebarDemo() {
  const [active, setActive] = React.useState('dashboard');
  const [expandedWidth, setExpandedWidth] = React.useState(240);
  const [collapsedWidth, setCollapsedWidth] = React.useState(64);
  const [mobileWidth, setMobileWidth] = React.useState(280);
  const [borderDegree, setBorderDegree] = React.useState<NajmBorderDegree>('strong');
  const [settingsOpen, setSettingsOpen] = React.useState(false);

  return (
    <div className="flex h-full overflow-hidden bg-background">
      <NSidebar
        borderDegree={borderDegree}
        logoIcon={GraduationCap}
        logoTitle="Najm School"
        logoSubtitle="Dashboard"
        navItems={sidebarItems}
        activePath={active}
        onNavigate={setActive}
        widths={{ expanded: expandedWidth, collapsed: collapsedWidth, mobile: mobileWidth }}
        showCollapseButton
        collapseButtonPosition="edge"
        settingsLabel="Settings"
        onSettings={() => setSettingsOpen(true)}
        onLogout={() => {}}
      />
      <PagePanel active={active} borderDegree={borderDegree} />
      <SidebarSettingsSheet
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        expandedWidth={expandedWidth}
        collapsedWidth={collapsedWidth}
        mobileWidth={mobileWidth}
        borderDegree={borderDegree}
        onExpandedWidthChange={setExpandedWidth}
        onCollapsedWidthChange={setCollapsedWidth}
        onMobileWidthChange={setMobileWidth}
        onBorderDegreeChange={setBorderDegree}
      />
    </div>
  );
}

export function SidebarPage() {
  return (
    <ComponentPage
      title="Sidebar"
      description="Standalone navigation sidebar shown as one complete app shell with enough vertical space to inspect the layout."
      category="Layout"
    >
      <Example
        title="Full Sidebar Shell"
        description="Uses only the preview frame around the shell; the sidebar border degree is adjustable and content cards stay bordered."
        previewHeight="h-[720px]"
        noPad
        center={false}
        code={`import { Input, NCard, NSheet, NSidebar, NPageHeader, type NajmBorderDegree } from 'najm-kit';
import { GraduationCap, LayoutDashboard } from 'lucide-react';

const borderDegrees: NajmBorderDegree[] = ['none', 'subtle', 'default', 'strong'];

const [expandedWidth, setExpandedWidth] = React.useState(240);
const [collapsedWidth, setCollapsedWidth] = React.useState(64);
const [mobileWidth, setMobileWidth] = React.useState(280);
const [borderDegree, setBorderDegree] = React.useState<NajmBorderDegree>('strong');
const [settingsOpen, setSettingsOpen] = React.useState(false);

<div className="flex h-screen overflow-hidden bg-background">
  <NSidebar
    borderDegree={borderDegree}
    logoIcon={GraduationCap}
    logoTitle="Najm School"
    logoSubtitle="Dashboard"
    navItems={navItems}
    activePath={active}
    onNavigate={setActive}
    widths={{ expanded: expandedWidth, collapsed: collapsedWidth, mobile: mobileWidth }}
    showCollapseButton
    collapseButtonPosition="edge"
    settingsLabel="Settings"
    onSettings={() => setSettingsOpen(true)}
    onLogout={() => {}}
  />

  <main className="min-w-0 flex-1 bg-background p-3">
    <NPageHeader bordered borderDegree={borderDegree} icon={LayoutDashboard} title="Dashboard" />
    <section className="mt-3 grid gap-3">
      <NCard borderDegree={borderDegree}>Stats use borderDegree</NCard>
      <NCard borderDegree={borderDegree}>Rows use borderDegree</NCard>
    </section>
  </main>

  <NSheet open={settingsOpen} onOpenChange={setSettingsOpen} title="Settings">
    {borderDegrees.map((degree) => (
      <button key={degree} type="button" onClick={() => setBorderDegree(degree)}>
        {degree}
      </button>
    ))}
    <Input type="number" value={expandedWidth} onChange={(event) => setExpandedWidth(Number(event.currentTarget.value))} />
    <Input type="number" value={collapsedWidth} onChange={(event) => setCollapsedWidth(Number(event.currentTarget.value))} />
    <Input type="number" value={mobileWidth} onChange={(event) => setMobileWidth(Number(event.currentTarget.value))} />
  </NSheet>
</div>`}
      >
        <FullSidebarDemo />
      </Example>
    </ComponentPage>
  );
}
