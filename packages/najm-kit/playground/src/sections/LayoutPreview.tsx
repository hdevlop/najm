import React, { useState } from "react";
import {
  NAppShell,
  NCommandPalette,
  NButton,
  Card,
  CardContent,
} from 'najm-kit';
import type { NavItem, NAppCommandItem } from "najm-kit";
import {
  Home,
  Users,
  Settings,
  BarChart3,
  FileText,
  Bell,
  Search,
  Palette,
  LayoutDashboard,
} from "lucide-react";

const navItems: NavItem[] = [
  { id: "home", label: "Home", href: "/home", icon: Home },
  { id: "dashboard", label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  {
    id: "analytics",
    label: "Analytics",
    icon: BarChart3,
    children: [
      { id: "overview", label: "Overview", href: "/analytics/overview", icon: BarChart3 },
      { id: "reports", label: "Reports", href: "/analytics/reports", icon: FileText },
    ],
  },
  { id: "users", label: "Users", href: "/users", icon: Users, badge: <span className="text-xs bg-primary text-primary-foreground rounded-full px-1.5">12</span> },
  { id: "settings", label: "Settings", href: "/settings", icon: Settings },
];

const commandItems: NAppCommandItem[] = [
  { id: "home", label: "Go to Home", icon: Home, onSelect: () => {}, group: "Navigation" },
  { id: "dashboard", label: "Go to Dashboard", icon: LayoutDashboard, onSelect: () => {}, group: "Navigation" },
  { id: "users", label: "Manage Users", icon: Users, onSelect: () => {}, group: "Navigation" },
  { id: "settings", label: "Open Settings", icon: Settings, onSelect: () => {}, group: "Actions" },
  { id: "notifications", label: "View Notifications", icon: Bell, shortcut: "⌘N", onSelect: () => {}, group: "Actions" },
];

export default function LayoutPreview() {
  const [activePath, setActivePath] = useState("/home");
  const [collapsed, setCollapsed] = useState(false);
  const [cmdOpen, setCmdOpen] = useState(false);

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold">Layout</h2>

      <div className="flex gap-3 flex-wrap">
        <NButton variant="outline" onClick={() => setCollapsed(!collapsed)}>
          Toggle Collapsed: {collapsed ? "ON" : "OFF"}
        </NButton>
        <NButton variant="outline" onClick={() => setCmdOpen(true)}>
          Open Command Palette
        </NButton>
      </div>

      <div className="border rounded-lg overflow-hidden" style={{ height: 500 }}>
        <NAppShell
          logo={
            <div className="flex items-center gap-2">
              <Palette className="h-6 w-6 text-primary" />
              <span className="font-bold text-lg">Najm</span>
            </div>
          }
          title="Dashboard"
          navItems={navItems}
          activePath={activePath}
          onNavigate={setActivePath}
          collapsed={collapsed}
          onCollapsedChange={setCollapsed}
          user={{
            name: "Admin User",
            email: "admin@example.com",
            fallback: "AU",
          }}
          actions={[
            { id: "search", label: "Search", icon: Search, onClick: () => setCmdOpen(true) },
            { id: "notifications", label: "Notifications", icon: Bell, onClick: () => {} },
          ]}
          userMenuActions={[
            { id: "profile", label: "Profile", icon: Users, onClick: () => {} },
            { id: "settings", label: "Settings", icon: Settings, onClick: () => {}, separator: true },
          ]}
          onLogout={() => alert("Logout clicked")}
        >
          <div className="p-6 space-y-4">
            <Card>
              <CardContent className="pt-6">
                <h3 className="text-lg font-semibold mb-2">Page Content</h3>
                <p className="text-sm text-muted-foreground">
                  Active route: <code className="bg-muted px-1.5 py-0.5 rounded text-sm">{activePath}</code>
                </p>
                <p className="text-sm text-muted-foreground mt-2">
                  Click sidebar items to navigate. Use the menu button to toggle collapsed mode.
                  Try the nested "Analytics" item.
                </p>
              </CardContent>
            </Card>
          </div>
        </NAppShell>
      </div>

      <NCommandPalette
        commands={commandItems}
        open={cmdOpen}
        onOpenChange={setCmdOpen}
        placeholder="Type a command or search..."
      />
    </div>
  );
}
