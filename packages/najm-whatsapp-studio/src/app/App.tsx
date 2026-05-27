import React, { useEffect, useState } from 'react';
import { NSidebar, NErrorBoundary } from 'najm-ui';
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
import { useActiveView } from '../shared/hooks/useActiveView';
import type { PanelId } from '../shared/hooks/useActiveView';
import { SidebarInstance } from '../shared/components/layout/SidebarInstance';
import { DashboardView } from '../features/dashboard';
import { InstancesView } from '../features/instances';
import { ConversationsView } from '../features/conversations';
import { ContactsView } from '../features/contacts';
import { GroupsView } from '../features/groups';
import { ChatOpsView } from '../features/chat-ops';
import { LabelsView } from '../features/labels';
import { BotView } from '../features/bot';
import { ProfileView } from '../features/profile';
import { WebhooksView } from '../features/webhooks';
import { SettingsView } from '../features/settings';

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

export function WhatsAppStudioApp() {
  const { panel, setPanel } = useActiveView();
  const [selectedJid, setSelectedJid] = useState<string | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent<PanelId>).detail;
      if (detail) setPanel(detail);
    };
    window.addEventListener('wa-studio:navigate', handler);
    return () => window.removeEventListener('wa-studio:navigate', handler);
  }, [setPanel]);

  return (
    <div className="dark h-full w-full">
      <div className="flex h-full w-full overflow-hidden bg-bg">
        <NSidebar
          logoIcon={MessagesSquare}
          logoTitle="WhatsApp Studio"
          logoSubtitle="Operations"
          navItems={navItems}
          activePath={panel}
          onNavigate={(href) => setPanel(href as PanelId)}
          showSectionIcons={false}
          showSectionSeparators
          onSettings={() => setPanel('settings')}
          footer={<SidebarInstance />}
        />
        <main className="flex-1 h-full overflow-hidden flex flex-col min-w-0">
          <NErrorBoundary key={panel} fallbackTitle="Something went wrong">
            {panel === 'dashboard' && <DashboardView />}
            {panel === 'instances' && <InstancesView />}
            {panel === 'conversations' && (
              <ConversationsView
                selectedJid={selectedJid}
                onSelectConversation={(jid) => setSelectedJid(jid)}
              />
            )}
            {panel === 'contacts' && <ContactsView />}
            {panel === 'groups' && <GroupsView />}
            {panel === 'chat-ops' && <ChatOpsView jid={selectedJid} />}
            {panel === 'labels' && <LabelsView jid={selectedJid} />}
            {panel === 'bot' && <BotView />}
            {panel === 'profile' && <ProfileView />}
            {panel === 'webhooks' && <WebhooksView />}
            {panel === 'settings' && <SettingsView />}
          </NErrorBoundary>
        </main>
      </div>
    </div>
  );
}
