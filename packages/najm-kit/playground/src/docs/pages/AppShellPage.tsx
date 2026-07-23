import React, { useState } from 'react';
import {
  NAppShell,
  NSidebar,
  NNavbar,
  NButton,
} from 'najm-kit';
import type { NavItem, NAppShellUser, NAppShellAction, UserMenuAction } from 'najm-kit';
import { ComponentPage } from '../ComponentPage';
import { Example } from '../Example';
import {
  LayoutDashboard,
  Users,
  ShoppingCart,
  BarChart3,
  Settings,
  FileText,
  Bell,
  Search,
  HelpCircle,
  Package,
  Tags,
  CreditCard,
  Shield,
  Inbox,
  Bookmark,
  User,
  LogOut,
  ChevronRight,
  Plus,
  Zap,
} from 'lucide-react';

// ── Shared demo data ────────────────────────────────────────────────────────

const demoUser: NAppShellUser = {
  name: 'Alice Johnson',
  email: 'alice@example.com',
  fallback: 'AJ',
};

const basicNavItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'users', label: 'Users', icon: Users },
  { id: 'orders', label: 'Orders', icon: ShoppingCart },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const sectionedNavItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, sectionLabel: 'Overview' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3, sectionLabel: 'Overview' },
  { id: 'products', label: 'Products', icon: Package, sectionLabel: 'Catalog' },
  { id: 'categories', label: 'Categories', icon: Tags, sectionLabel: 'Catalog' },
  { id: 'users', label: 'Users', icon: Users, sectionLabel: 'Management' },
  { id: 'orders', label: 'Orders', icon: ShoppingCart, sectionLabel: 'Management' },
  { id: 'billing', label: 'Billing', icon: CreditCard, sectionLabel: 'Management' },
  { id: 'settings', label: 'Settings', icon: Settings, sectionLabel: 'System' },
  { id: 'security', label: 'Security', icon: Shield, sectionLabel: 'System' },
];

const badgeNavItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  {
    id: 'inbox',
    label: 'Inbox',
    icon: Inbox,
    badge: <span className="rounded-full bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5 font-medium">12</span>,
  },
  {
    id: 'orders',
    label: 'Orders',
    icon: ShoppingCart,
    badge: <span className="rounded-full bg-amber-500 text-white text-[10px] px-1.5 py-0.5 font-medium">3</span>,
  },
  { id: 'bookmarks', label: 'Bookmarks', icon: Bookmark },
  { id: 'reports', label: 'Reports', icon: FileText, disabled: true },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const nestedNavItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  {
    id: 'catalog',
    label: 'Catalog',
    icon: Package,
    children: [
      { id: 'products', label: 'Products' },
      { id: 'categories', label: 'Categories' },
      { id: 'inventory', label: 'Inventory' },
    ],
  },
  {
    id: 'users-group',
    label: 'Users',
    icon: Users,
    children: [
      { id: 'all-users', label: 'All Users' },
      { id: 'roles', label: 'Roles & Permissions' },
      { id: 'invitations', label: 'Invitations' },
    ],
  },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'settings', label: 'Settings', icon: Settings },
];

const navbarActions: NAppShellAction[] = [
  {
    id: 'search',
    label: 'Search',
    icon: Search,
    onClick: () => {},
    hideOnMobile: true,
  },
  {
    id: 'notifications',
    label: 'Notifications',
    icon: Bell,
    onClick: () => {},
    badge: <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2 rounded-full bg-primary" />,
  },
  {
    id: 'help',
    label: 'Help',
    icon: HelpCircle,
    onClick: () => {},
    hideOnMobile: true,
  },
];

const userMenuActions: UserMenuAction[] = [
  { id: 'profile', label: 'Profile', icon: User, onClick: () => {} },
  { id: 'billing', label: 'Billing', icon: CreditCard, onClick: () => {} },
  { id: 'settings', label: 'Settings', icon: Settings, onClick: () => {}, separator: true },
];

// ── Logo ────────────────────────────────────────────────────────────────────

function AppLogo({ collapsed }: { collapsed?: boolean }) {
  return (
    <div className="flex items-center gap-2 px-2">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary">
        <Zap className="h-4 w-4 text-primary-foreground" />
      </div>
      {!collapsed && (
        <span className="text-sm font-bold tracking-tight">Acme Inc</span>
      )}
    </div>
  );
}

// ── Preview wrapper ──────────────────────────────────────────────────────────

function Preview({ children, height = 'h-[480px]' }: { children: React.ReactNode; height?: string }) {
  return (
    <div className={`${height} relative overflow-hidden rounded-lg border border-border`}>
      {children}
    </div>
  );
}

// ── Page content placeholders ────────────────────────────────────────────────

function PlaceholderContent({ active }: { active: string }) {
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold capitalize">{active.replace(/-/g, ' ')}</h2>
          <p className="text-sm text-muted-foreground">Welcome to the {active} section.</p>
        </div>
        <NButton size="sm"><Plus size={14} /> New</NButton>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {[142, 89, 37].map((n, i) => (
          <div key={i} className="rounded-lg border border-border bg-card p-4">
            <p className="text-xs text-muted-foreground">Metric {i + 1}</p>
            <p className="text-2xl font-bold mt-1">{n}</p>
          </div>
        ))}
      </div>
      <div className="h-32 rounded-lg border border-border bg-card/50 flex items-center justify-center text-sm text-muted-foreground">
        Content area
      </div>
    </div>
  );
}

// ── Controlled collapse demo (needs own hook state) ──────────────────────────

function ControlledCollapseDemo() {
  const [collapsed, setCollapsed] = useState(false);
  return (
    <div className="space-y-3">
      <NButton
        size="sm"
        variant="outline"
        onClick={() => setCollapsed((c) => !c)}
      >
        <ChevronRight
          size={14}
          className={`transition-transform duration-200 ${collapsed ? '' : 'rotate-180'}`}
        />
        {collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
      </NButton>
      <Preview height="h-[420px]">
        <NAppShell
          logo={<AppLogo collapsed={collapsed} />}
          navItems={basicNavItems}
          activePath="dashboard"
          onNavigate={() => {}}
          collapsed={collapsed}
          onCollapsedChange={setCollapsed}
          user={demoUser}
        >
          <PlaceholderContent active="dashboard" />
        </NAppShell>
      </Preview>
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

export function AppShellPage() {
  const [active1, setActive1] = useState('dashboard');
  const [active2, setActive2] = useState('dashboard');
  const [active3, setActive3] = useState('dashboard');
  const [active4, setActive4] = useState('dashboard');
  const [active5, setActive5] = useState('dashboard');
  const [active6, setActive6] = useState('dashboard');
  const [sidebarActive, setSidebarActive] = useState('dashboard');

  return (
    <ComponentPage
      title="App Shell"
      description="Full application layout with a collapsible sidebar, top navbar, user menu, and mobile drawer. Compose NAppShell for the full shell or use NSidebar standalone."
      category="Layout"
    >

      {/* 1 ── Full app shell */}
      <Example
        title="Full App Shell"
        description="NAppShell combines NSidebar + NNavbar into a single managed component. Handles collapse, mobile drawer, and keyboard shortcuts."
        code={`import { NAppShell } from 'najm-kit';
import type { NavItem, NAppShellUser, NAppShellAction, UserMenuAction } from 'najm-kit';

const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'users',     label: 'Users',     icon: Users },
  { id: 'orders',    label: 'Orders',    icon: ShoppingCart },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
  { id: 'settings',  label: 'Settings',  icon: Settings },
];

const user: NAppShellUser = {
  name: 'Alice Johnson',
  email: 'alice@example.com',
};

const actions: NAppShellAction[] = [
  { id: 'notifications', label: 'Notifications', icon: Bell, onClick: () => {} },
  { id: 'help',          label: 'Help',           icon: HelpCircle, onClick: () => {} },
];

const userMenuActions: UserMenuAction[] = [
  { id: 'profile',  label: 'Profile',  icon: User },
  { id: 'settings', label: 'Settings', icon: Settings, separator: true },
];

<NAppShell
  logo={<AppLogo />}
  navItems={navItems}
  activePath={activePath}
  onNavigate={setActivePath}
  user={user}
  actions={actions}
  userMenuActions={userMenuActions}
  onLogout={() => console.log('logout')}
>
  <YourPageContent />
</NAppShell>`}
      >
        <Preview>
          <NAppShell
            logo={<AppLogo />}
            navItems={basicNavItems}
            activePath={active1}
            onNavigate={setActive1}
            user={demoUser}
            actions={navbarActions}
            userMenuActions={userMenuActions}
            onLogout={() => {}}
          >
            <PlaceholderContent active={active1} />
          </NAppShell>
        </Preview>
      </Example>

      {/* 2 ── Collapsed by default */}
      <Example
        title="Collapsed sidebar"
        description="Use defaultCollapsed to start with an icon-only sidebar. The collapse button in the footer toggles it open."
        code={`<NAppShell
  logo={<AppLogo />}
  navItems={navItems}
  activePath={activePath}
  onNavigate={setActivePath}
  defaultCollapsed
  user={user}
>
  <PageContent />
</NAppShell>`}
      >
        <Preview>
          <NAppShell
            logo={<AppLogo collapsed />}
            navItems={basicNavItems}
            activePath={active2}
            onNavigate={setActive2}
            user={demoUser}
            actions={navbarActions}
            defaultCollapsed
          >
            <PlaceholderContent active={active2} />
          </NAppShell>
        </Preview>
      </Example>

      {/* 3 ── Sectioned nav */}
      <Example
        title="Navigation sections"
        description="Group nav items with sectionLabel to visually separate areas of your app."
        code={`const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, sectionLabel: 'Overview' },
  { id: 'analytics', label: 'Analytics', icon: BarChart3,       sectionLabel: 'Overview' },
  { id: 'products',  label: 'Products',  icon: Package,         sectionLabel: 'Catalog' },
  { id: 'categories',label: 'Categories',icon: Tags,            sectionLabel: 'Catalog' },
  { id: 'users',     label: 'Users',     icon: Users,           sectionLabel: 'Management' },
  { id: 'orders',    label: 'Orders',    icon: ShoppingCart,    sectionLabel: 'Management' },
  { id: 'settings',  label: 'Settings',  icon: Settings,        sectionLabel: 'System' },
  { id: 'security',  label: 'Security',  icon: Shield,          sectionLabel: 'System' },
];

<NAppShell navItems={navItems} ... />`}
      >
        <Preview>
          <NAppShell
            logo={<AppLogo />}
            navItems={sectionedNavItems}
            activePath={active3}
            onNavigate={setActive3}
            user={demoUser}
            actions={navbarActions}
          >
            <PlaceholderContent active={active3} />
          </NAppShell>
        </Preview>
      </Example>

      {/* 4 ── Badges and disabled */}
      <Example
        title="Badges and disabled items"
        description="Add badge to a NavItem for notification counts or status chips. Set disabled to make an item non-interactive."
        code={`const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  {
    id: 'inbox',
    label: 'Inbox',
    icon: Inbox,
    badge: (
      <span className="rounded-full bg-primary text-primary-foreground text-[10px] px-1.5 py-0.5">
        12
      </span>
    ),
  },
  {
    id: 'orders',
    label: 'Orders',
    icon: ShoppingCart,
    badge: (
      <span className="rounded-full bg-amber-500 text-white text-[10px] px-1.5 py-0.5">
        3
      </span>
    ),
  },
  { id: 'reports',  label: 'Reports',  icon: FileText, disabled: true },
  { id: 'settings', label: 'Settings', icon: Settings },
];`}
      >
        <Preview>
          <NAppShell
            logo={<AppLogo />}
            navItems={badgeNavItems}
            activePath={active4}
            onNavigate={setActive4}
            user={demoUser}
            userMenuActions={userMenuActions}
            onLogout={() => {}}
          >
            <PlaceholderContent active={active4} />
          </NAppShell>
        </Preview>
      </Example>

      {/* 5 ── Nested items */}
      <Example
        title="Nested sub-items"
        description="Add a children array to a NavItem to create collapsible sub-menus."
        code={`const navItems: NavItem[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  {
    id: 'catalog',
    label: 'Catalog',
    icon: Package,
    children: [
      { id: 'products',   label: 'Products' },
      { id: 'categories', label: 'Categories' },
      { id: 'inventory',  label: 'Inventory' },
    ],
  },
  {
    id: 'users-group',
    label: 'Users',
    icon: Users,
    children: [
      { id: 'all-users',    label: 'All Users' },
      { id: 'roles',        label: 'Roles & Permissions' },
      { id: 'invitations',  label: 'Invitations' },
    ],
  },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 },
];`}
      >
        <Preview>
          <NAppShell
            logo={<AppLogo />}
            navItems={nestedNavItems}
            activePath={active5}
            onNavigate={setActive5}
            user={demoUser}
          >
            <PlaceholderContent active={active5} />
          </NAppShell>
        </Preview>
      </Example>

      {/* 6 ── Sidebar footer slot */}
      <Example
        title="Custom sidebar footer"
        description="Pass sidebarFooter to render any content at the bottom of the sidebar — upgrade prompts, workspace switchers, etc."
        code={`<NAppShell
  navItems={navItems}
  sidebarFooter={
    <div className="mx-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
      <p className="text-xs font-semibold text-primary">Free plan</p>
      <p className="text-xs text-muted-foreground mt-0.5">3 of 5 projects used</p>
      <div className="mt-2 h-1.5 rounded-full bg-primary/20">
        <div className="h-full w-3/5 rounded-full bg-primary" />
      </div>
      <NButton size="sm" className="mt-3 w-full h-7 text-xs">Upgrade plan</NButton>
    </div>
  }
  ...
>
  <PageContent />
</NAppShell>`}
      >
        <Preview>
          <NAppShell
            logo={<AppLogo />}
            navItems={basicNavItems}
            activePath={active6}
            onNavigate={setActive6}
            user={demoUser}
            sidebarFooter={
              <div className="mx-3 rounded-lg border border-primary/20 bg-primary/5 p-3">
                <p className="text-xs font-semibold text-primary">Free plan</p>
                <p className="text-xs text-muted-foreground mt-0.5">3 of 5 projects used</p>
                <div className="mt-2 h-1.5 rounded-full bg-primary/20">
                  <div className="h-full w-3/5 rounded-full bg-primary" />
                </div>
                <NButton size="sm" className="mt-3 w-full h-7 text-xs">Upgrade plan</NButton>
              </div>
            }
          >
            <PlaceholderContent active={active6} />
          </NAppShell>
        </Preview>
      </Example>

      {/* 7 ── NSidebar standalone */}
      <Example
        title="NSidebar standalone"
        description="Use NSidebar directly when you want to build your own top bar or compose a custom layout."
        code={`import { NSidebar } from 'najm-kit';

<div className="flex h-screen">
  <NSidebar
    logoTitle="Acme"
    logoSubtitle="Dashboard"
    navItems={navItems}
    activePath={active}
    onNavigate={setActive}
    showCollapseButton
    collapseButtonPosition="edge"
    onLogout={() => {}}
    onSettings={() => {}}
  />
  <main className="flex-1 overflow-y-auto p-6">
    {/* your content */}
  </main>
</div>`}
      >
        <Preview>
          <div className="flex h-full">
            <NSidebar
              logoIcon={Zap}
              logoTitle="Acme Inc"
              logoSubtitle="Workspace"
              navItems={sectionedNavItems}
              activePath={sidebarActive}
              onNavigate={setSidebarActive}
              showCollapseButton
              collapseButtonPosition="edge"
              onSettings={() => {}}
              onLogout={() => {}}
            />
            <div className="flex flex-1 flex-col overflow-hidden">
              <div className="flex h-14 items-center border-b border-border bg-card px-5">
                <h1 className="text-sm font-semibold capitalize">{sidebarActive.replace(/-/g, ' ')}</h1>
              </div>
              <main className="flex-1 overflow-y-auto">
                <PlaceholderContent active={sidebarActive} />
              </main>
            </div>
          </div>
        </Preview>
      </Example>

      {/* 8 ── NNavbar standalone */}
      <Example
        title="NNavbar standalone"
        description="NNavbar is the top bar portion of NAppShell. Use it alone to build page-level headers with user menus and action buttons."
        code={`import { NNavbar } from 'najm-kit';

<NNavbar
  title="Dashboard"
  user={{ name: 'Alice Johnson', email: 'alice@example.com' }}
  actions={[
    { id: 'search', label: 'Search', icon: Search, onClick: () => {} },
    { id: 'bell',   label: 'Notifications', icon: Bell, onClick: () => {} },
  ]}
  userMenuActions={[
    { id: 'profile',  label: 'Profile',  icon: User },
    { id: 'settings', label: 'Settings', icon: Settings, separator: true },
  ]}
  onLogout={() => console.log('logout')}
  onToggleSidebar={() => {}}
/>`}
      >
        <div className="rounded-lg border border-border overflow-hidden">
          <NNavbar
            title="Dashboard"
            user={demoUser}
            actions={navbarActions}
            userMenuActions={userMenuActions}
            onLogout={() => {}}
            onToggleSidebar={() => {}}
          />
          <div className="h-24 flex items-center justify-center text-sm text-muted-foreground bg-card/30">
            Page content area
          </div>
        </div>
      </Example>

      {/* 9 ── Controlled collapse */}
      <Example
        title="Controlled collapse"
        description="Manage the collapsed state yourself using the collapsed and onCollapsedChange props."
        code={`const [collapsed, setCollapsed] = useState(false);

<NAppShell
  collapsed={collapsed}
  onCollapsedChange={setCollapsed}
  navItems={navItems}
  ...
>
  <PageContent />
</NAppShell>

// Toggle from anywhere in your app:
<NButton onClick={() => setCollapsed(c => !c)}>Toggle sidebar</NButton>`}
      >
        <ControlledCollapseDemo />
      </Example>

    </ComponentPage>
  );
}
