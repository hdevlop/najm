import React, { useEffect } from 'react';
import { createRootRoute, Outlet, useNavigate, useRouterState } from '@tanstack/react-router';
import { NSidebar, NErrorBoundary } from 'najm-kit';
import {
  LayoutDashboard,
  Server,
  MessageCircle,
  Users,
  FolderKanban,
  Wrench,
  Tag,
  Bot,
  UserCircle,
  Webhook,
  Settings,
  MessagesSquare,
} from 'lucide-react';
import { SidebarInstance } from '@/shared/components/layout/SidebarInstance';
import type { PanelId } from '@/providers/types';

const navItems = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, sectionLabel: 'Overview' },
  { id: 'instances', label: 'Instances', icon: Server, sectionLabel: 'Overview' },
  { id: 'conversations', label: 'Conversations', icon: MessageCircle, sectionLabel: 'Chat' },
  { id: 'contacts', label: 'Contacts', icon: Users, sectionLabel: 'Chat' },
  { id: 'groups', label: 'Groups', icon: FolderKanban, sectionLabel: 'Chat' },
  { id: 'chat-ops', label: 'Chat Ops', icon: Wrench, sectionLabel: 'Operations' },
  { id: 'labels', label: 'Labels', icon: Tag, sectionLabel: 'Operations' },
  { id: 'bot', label: 'Bot', icon: Bot, sectionLabel: 'Operations' },
  { id: 'webhooks', label: 'Webhooks', icon: Webhook, sectionLabel: 'Configuration' },
  { id: 'profile', label: 'Profile', icon: UserCircle, sectionLabel: 'Configuration' },
  { id: 'settings', label: 'Settings', icon: Settings, sectionLabel: 'Configuration' },
];

const PANEL_TO_PATH: Record<string, string> = {
  dashboard: '/',
  instances: '/instances',
  conversations: '/conversations',
  contacts: '/contacts',
  groups: '/groups',
  'chat-ops': '/chat-ops',
  labels: '/labels',
  bot: '/bot',
  webhooks: '/webhooks',
  profile: '/profile',
  settings: '/settings',
};

function pathToPanelId(pathname: string): string {
  const base = typeof window !== 'undefined' ? (window as any).__waStudioBasePath || '' : '';
  const rel = base && pathname.startsWith(base) ? pathname.slice(base.length) || '/' : pathname;
  const segment = rel.replace(/\/+$/, '') || '/';
  if (segment === '/') return 'dashboard';
  return segment.slice(1);
}

export const rootRoute = createRootRoute({
  component: RootLayout,
});

function RootLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const activePanel = pathToPanelId(pathname);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<PanelId>).detail;
      if (detail) {
        const target = PANEL_TO_PATH[detail] ?? '/';
        navigate({ to: target });
      }
    };
    window.addEventListener('wa-studio:navigate', handler);
    return () => window.removeEventListener('wa-studio:navigate', handler);
  }, [navigate]);

  const handleNavigate = (href: string) => {
    const target = PANEL_TO_PATH[href] ?? '/';
    navigate({ to: target });
  };

  return (
    <div className="dark h-full w-full">
      <div className="flex h-full w-full overflow-hidden bg-bg">
        <NSidebar
          logoIcon={MessagesSquare}
          logoTitle="WhatsApp Studio"
          logoSubtitle="Operations"
          navItems={navItems}
          activePath={activePanel}
          onNavigate={handleNavigate}
          showSectionIcons={false}
          showSectionSeparators
          onSettings={() => navigate({ to: '/settings' })}
          footer={<SidebarInstance />}
        />
        <main className="flex-1 h-full overflow-hidden flex flex-col min-w-0">
          <NErrorBoundary key={pathname} fallbackTitle="Something went wrong">
            <Outlet />
          </NErrorBoundary>
        </main>
      </div>
    </div>
  );
}
