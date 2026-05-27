import { useEffect, useState } from 'react';

export type PanelId =
  | 'dashboard'
  | 'instances'
  | 'conversations'
  | 'contacts'
  | 'groups'
  | 'chat-ops'
  | 'labels'
  | 'bot'
  | 'profile'
  | 'webhooks'
  | 'settings';

const STORAGE_KEY = 'wa-studio.activePanel';
const VALID: readonly PanelId[] = [
  'dashboard',
  'instances',
  'conversations',
  'contacts',
  'groups',
  'chat-ops',
  'labels',
  'bot',
  'profile',
  'webhooks',
  'settings',
];

function readInitial(): PanelId {
  if (typeof window === 'undefined') return 'dashboard';
  try {
    const v = window.localStorage.getItem(STORAGE_KEY) as PanelId | null;
    // Migrate old 'messages' panel to conversations
    if ((v as string) === 'messages') return 'conversations';
    return v && VALID.includes(v) ? v : 'dashboard';
  } catch {
    return 'dashboard';
  }
}

export function useActiveView() {
  const [panel, setPanel] = useState<PanelId>(readInitial);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      window.localStorage.setItem(STORAGE_KEY, panel);
    } catch {
      // ignore
    }
  }, [panel]);

  return { panel, setPanel };
}
